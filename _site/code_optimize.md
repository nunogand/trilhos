BASE
{% for image in site.static_files %}

{% if image.path contains post.folder %}

{% comment %} <!-- filter to avoid all but image files --> {% endcomment %}
{% if image.extname == '.jpg' or image.extname == '.jpeg' or image.extname == '.JPG' or image.extname == '.JPEG' %}


{% comment %} <!-- add image to list--> {% endcomment %}
{% assign headers = headers | push: image.path %}
{% endif %}
{% endif %}

{% endfor %}


{% assign random-header = headers | sample %}

Optimized Version 1: Using Liquid Array Operations
{% assign headers = site.static_files | where_exp: "file", "file.path contains post.folder and file.extname == '.jpg' or file.extname == '.jpeg' or file.extname == '.JPG' or file.extname == '.JPEG'" | map: "path" %}

{% if headers.size > 0 %}
  {% assign random-header = headers | sample %}
{% endif %}

Optimized Version 2: Case-Insensitive Extension Check
{% assign headers = site.static_files | where_exp: "file", "file.path contains post.folder" | where_exp: "file", "file.extname == '.jpg' or file.extname == '.jpeg'" | map: "path" %}

{% if headers.size > 0 %}
  {% assign random-header = headers | sample %}
{% endif %}
