FROM php:8.2-apache

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    poppler-utils \
    unzip \
    libzip-dev \
  && docker-php-ext-install zip \
  && rm -rf /var/lib/apt/lists/*

RUN a2enmod rewrite \
  && docker-php-ext-install mysqli

# Allow .htaccess overrides
RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

WORKDIR /var/www/html
COPY . /var/www/html

EXPOSE 80
