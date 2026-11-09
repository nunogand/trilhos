# frozen_string_literal: true

require "nokogiri"
require "time"

module Trilhos
  class GpxStatsGenerator < Jekyll::Generator
    safe true
    priority :high

    EARTH_RADIUS_METERS = 6_371_000.0

    def generate(site)
      site.posts.docs.each do |post|
        folder = media_folder(post)

        if folder.empty?
          Jekyll.logger.warn(
            "Trilhos:",
            "O post #{post.relative_path} não define folder nem slug."
          )

          next
        end

        media_directory = File.join(
          site.source,
          "fotos",
          folder
        )

        unless Dir.exist?(media_directory)
          Jekyll.logger.warn(
            "Trilhos:",
            "Pasta inexistente: #{media_directory}"
          )

          next
        end

        gpx_files = Dir.glob(
          File.join(media_directory, "*.{gpx,GPX}")
        ).sort

        if gpx_files.empty?
          Jekyll.logger.warn(
            "Trilhos:",
            "Sem GPX em assets/media/#{folder}/"
          )

          next
        end

        # Se existirem vários GPX, usa o primeiro alfabeticamente.
        gpx_file = gpx_files.first

        begin
          stats = calculate_stats(gpx_file)

          post.data["gpx_path"] =
            "/fotos/#{folder}/#{File.basename(gpx_file)}"

          post.data["gpx_stats"] = stats

          # Valores diretos, mais simples de usar nos cartões.
          post.data["distance"] = stats["distance_km"]
          post.data["duration"] = stats["duration_formatted"]
          post.data["duration_minutes"] = stats["duration_minutes"]

          post.data["elevation_min"] =
            stats["elevation_min_m"]

          post.data["elevation_max"] =
            stats["elevation_max_m"]

          post.data["elevation_gain"] =
            stats["elevation_gain_m"]

          post.data["elevation_loss"] =
            stats["elevation_loss_m"]

          post.data["gpx_points"] =
            stats["point_count"]

          Jekyll.logger.info(
            "Trilhos:",
            "#{post.data['title']}: " \
            "#{stats['distance_km']} km, " \
            "#{stats['duration_formatted']}, " \
            "máx. #{stats['elevation_max_m'] || 'N/D'} m"
          )
        rescue StandardError => error
          Jekyll.logger.error(
            "Trilhos:",
            "Erro em #{gpx_file}: #{error.message}"
          )
        end
      end
    end

    private

    def media_folder(post)
      explicit_folder = post.data["folder"].to_s.strip

      return explicit_folder unless explicit_folder.empty?

      post.data["slug"].to_s.strip
    end

    def calculate_stats(gpx_file)
      document = Nokogiri::XML(File.read(gpx_file)) do |config|
        config.strict.nonet
      end

      # Remove namespaces para permitir XPath simples em GPX 1.0 e 1.1.
      document.remove_namespaces!

      segments = extract_segments(document)

      if segments.empty?
        raise "O GPX não contém trkseg, trkpt ou rtept válidos."
      end

      point_count = segments.sum(&:length)

      if point_count < 2
        raise "O GPX contém menos de dois pontos válidos."
      end

      total_distance = calculate_total_distance(segments)

      elevations = segments
        .flatten
        .filter_map { |point| point[:elevation] }

      elevation_gain, elevation_loss =
        calculate_elevation_changes(segments)

      timestamps = segments
        .flatten
        .filter_map { |point| point[:time] }
        .sort

      duration_seconds =
        calculate_duration_seconds(timestamps)

      duration_minutes =
        duration_seconds.nil? ? nil : (duration_seconds / 60.0).round

      {
        "distance_km" =>
          (total_distance / 1000.0).round(2),

        "distance_m" =>
          total_distance.round,

        "duration_seconds" =>
          duration_seconds&.round,

        "duration_minutes" =>
          duration_minutes,

        "duration_formatted" =>
          format_duration(duration_seconds),

        "elevation_min_m" =>
          elevations.empty? ? nil : elevations.min.round,

        "elevation_max_m" =>
          elevations.empty? ? nil : elevations.max.round,

        "elevation_gain_m" =>
          elevation_gain.round,

        "elevation_loss_m" =>
          elevation_loss.round,

        "point_count" =>
          point_count,

        "segment_count" =>
          segments.length
      }
    end

    def extract_segments(document)
      track_segments = document.xpath("//trkseg")

      unless track_segments.empty?
        return track_segments
          .map { |segment| parse_points(segment.xpath("./trkpt")) }
          .reject(&:empty?)
      end

      routes = document.xpath("//rte")

      unless routes.empty?
        return routes
          .map { |route| parse_points(route.xpath("./rtept")) }
          .reject(&:empty?)
      end

      # Fallback para GPX sem trkseg ou rte.
      track_points = document.xpath("//trkpt")

      return [parse_points(track_points)] unless track_points.empty?

      route_points = document.xpath("//rtept")

      return [parse_points(route_points)] unless route_points.empty?

      []
    end

    def parse_points(nodes)
      nodes.filter_map do |node|
        latitude = parse_number(node["lat"])
        longitude = parse_number(node["lon"])

        next unless latitude && longitude

        {
          latitude: latitude,
          longitude: longitude,
          elevation: parse_number(node.at_xpath("./ele")&.text),
          time: parse_time(node.at_xpath("./time")&.text)
        }
      end
    end

    def parse_number(value)
      return nil if value.nil?

      number = Float(value)

      number.finite? ? number : nil
    rescue ArgumentError, TypeError
      nil
    end

    def parse_time(value)
      return nil if value.nil? || value.strip.empty?

      Time.parse(value)
    rescue ArgumentError
      nil
    end

    def calculate_total_distance(segments)
      segments.sum do |segment|
        segment.each_cons(2).sum do |first, second|
          haversine_distance(first, second)
        end
      end
    end

    def calculate_elevation_changes(segments)
      gain = 0.0
      loss = 0.0

      segments.each do |segment|
        segment.each_cons(2) do |first, second|
          first_elevation = first[:elevation]
          second_elevation = second[:elevation]

          next if first_elevation.nil? || second_elevation.nil?

          difference = second_elevation - first_elevation

          if difference.positive?
            gain += difference
          elsif difference.negative?
            loss += difference.abs
          end
        end
      end

      [gain, loss]
    end

    def calculate_duration_seconds(timestamps)
      return nil if timestamps.length < 2

      duration = timestamps.last - timestamps.first

      duration.positive? ? duration : nil
    end

    def format_duration(seconds)
      return nil if seconds.nil?

      total_minutes = (seconds / 60.0).round
      hours = total_minutes / 60
      minutes = total_minutes % 60

      if hours.positive?
        format("%dh %02dm", hours, minutes)
      else
        format("%dm", minutes)
      end
    end

    def haversine_distance(first, second)
      latitude_1 = radians(first[:latitude])
      latitude_2 = radians(second[:latitude])

      latitude_difference =
        radians(second[:latitude] - first[:latitude])

      longitude_difference =
        radians(second[:longitude] - first[:longitude])

      haversine =
        Math.sin(latitude_difference / 2.0)**2 +
        Math.cos(latitude_1) *
        Math.cos(latitude_2) *
        Math.sin(longitude_difference / 2.0)**2

      angular_distance =
        2.0 * Math.atan2(
          Math.sqrt(haversine),
          Math.sqrt(1.0 - haversine)
        )

      EARTH_RADIUS_METERS * angular_distance
    end

    def radians(degrees)
      degrees * Math::PI / 180.0
    end
  end
end