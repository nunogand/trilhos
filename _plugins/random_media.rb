# frozen_string_literal: true

module Trilhos
  # Faz os sorteios de imagens UMA SÓ VEZ POR BUILD e guarda o resultado:
  #
  #   site.data["front_images"]   imagens do slideshow da página de entrada
  #   post.data["cover_path"]     capa de cada post (cartões e hero do trilho)
  #   post.data["photo_files"]    fotografias de cada post (ordem alfabética)
  #   post.data["photos_dir"]     pasta das fotografias do post
  #
  # Como o sorteio acontece uma só vez, a capa de um post é a MESMA em todo o
  # site durante esse build (página inicial, arquivo, página do trilho). Antes,
  # o sorteio era feito no Liquid, a cada vez que o cartão era desenhado, por
  # isso o mesmo post podia mostrar imagens diferentes em páginas diferentes.
  #
  # O que o utilizador define tem SEMPRE prioridade sobre o sorteio:
  #
  #   slideshow  1. front matter de index.html:  slideshow: [DSC_1547.JPG, ...]
  #              2. _config.yml:                 trilhos.front.images
  #              3. sorteio:                     trilhos.front.count de trilhos.front.folder
  #
  #   capa       1. front matter do post:        cover: DSC_0453.jpg
  #              2. _config.yml:                 trilhos.covers.<pasta>
  #              3. sorteio entre as fotografias da pasta do post
  #
  # Configuração (_config.yml):
  #
  #   trilhos:
  #     photos_root: fotos          # pasta com uma sub-pasta por post
  #     random_seed:                # opcional: nº inteiro → sorteios reproduzíveis
  #     front:
  #       folder: assets/front
  #       count: 4
  #       images: []                # opcional: lista fixa (desativa o sorteio)
  #     covers: {}                  # opcional: { arcos_de_valdevez: DSC_0453.jpg }
  class RandomMediaGenerator < Jekyll::Generator
    safe true
    priority :normal

    IMAGE_EXTENSIONS = %w[.jpg .jpeg .png .webp .avif .gif].freeze

    def generate(site)
      @site = site
      @config = hash_or_empty(site.config["trilhos"])
      @photos_root = clean_path(@config["photos_root"] || "fotos")
      @random = build_random

      site.data["front_images"] = pick_front_images
      assign_post_media
    end

    private

    # ---------------------------------------------------------------
    # Slideshow da página de entrada
    # ---------------------------------------------------------------

    def pick_front_images
      front = hash_or_empty(@config["front"])
      folder = clean_path(front["folder"] || "assets/front")
      fixed = Array(front["images"]).map { |name| name.to_s.strip }.reject(&:empty?)

      names =
        if fixed.empty?
          count = front.key?("count") ? [front["count"].to_i, 0].max : 4
          available = list_images(File.join(@site.source, folder))

          if available.size < count
            Jekyll.logger.warn(
              "Trilhos:",
              "#{folder}/ tem #{available.size} imagem(ns); o slideshow pede #{count}."
            )
          end

          available.sample(count, random: @random)
        else
          fixed
        end

      # Sem "/" → nome de ficheiro dentro da pasta; com "/" → caminho desde a raiz.
      names.map do |name|
        name.include?("/") ? "/#{clean_path(name)}" : "/#{folder}/#{name}"
      end
    end

    # ---------------------------------------------------------------
    # Capas e fotografias dos posts
    # ---------------------------------------------------------------

    def assign_post_media
      covers = hash_or_empty(@config["covers"])

      @site.posts.docs.each do |post|
        folder = media_folder(post)
        next if folder.empty?

        images = list_images(File.join(@site.source, @photos_root, folder))

        post.data["photos_dir"] = "/#{@photos_root}/#{folder}"
        post.data["photo_files"] = images

        cover = pick_cover(post, folder, covers, images)
        post.data["cover_path"] = cover unless cover.nil?
      end
    end

    def pick_cover(post, folder, covers, images)
      explicit = post.data["cover"].to_s.strip
      explicit = covers[folder].to_s.strip if explicit.empty?
      explicit = covers[post.data["slug"].to_s].to_s.strip if explicit.empty?

      return random_cover(images, folder) if explicit.empty?

      # URL completo ou caminho desde a raiz: usa-se tal como está.
      return explicit if explicit.include?("://") || explicit.start_with?("/")

      unless images.include?(explicit)
        Jekyll.logger.warn(
          "Trilhos:",
          "A capa '#{explicit}' não existe em #{@photos_root}/#{folder}/ (#{post.relative_path})."
        )
      end

      "/#{@photos_root}/#{folder}/#{explicit}"
    end

    # Sem capa definida: sorteia entre as fotografias da pasta.
    def random_cover(images, folder)
      chosen = images.sample(random: @random)
      chosen.nil? ? nil : "/#{@photos_root}/#{folder}/#{chosen}"
    end

    # ---------------------------------------------------------------
    # Auxiliares
    # ---------------------------------------------------------------

    # Mesma convenção do gpx_stats.rb: "folder" do front matter ou, na falta, o slug.
    def media_folder(post)
      explicit = post.data["folder"].to_s.strip
      return clean_path(explicit) unless explicit.empty?

      post.data["slug"].to_s.strip
    end

    def list_images(directory)
      return [] unless Dir.exist?(directory)

      Dir.children(directory)
         .select { |name| File.file?(File.join(directory, name)) }
         .select { |name| IMAGE_EXTENSIONS.include?(File.extname(name).downcase) }
         .sort
    end

    def clean_path(value)
      value.to_s.strip.gsub(%r{\A/+|/+\z}, "")
    end

    def hash_or_empty(value)
      value.is_a?(Hash) ? value : {}
    end

    def build_random
      seed = @config["random_seed"].to_s.strip
      seed.empty? ? Random.new : Random.new(seed.to_i)
    end
  end
end
