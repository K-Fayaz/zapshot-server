FROM node:18-slim

ENV NODE_ENV=production

WORKDIR /app

# Install Chrome runtime dependencies
RUN apt-get update && apt-get install -y \
  wget \
  gnupg \
  ca-certificates \
  fonts-liberation \
  fonts-ipafont-gothic \
  fonts-wqy-zenhei \
  fonts-thai-tlwg \
  fonts-kacst \
  fonts-freefont-ttf \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  ffmpeg \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Install Google Chrome (modern key handling)
RUN wget -qO /usr/share/keyrings/google-linux-signing-keyring.gpg \
    https://dl.google.com/linux/linux_signing_key.pub \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux-signing-keyring.gpg] \
     http://dl.google.com/linux/chrome/deb/ stable main" \
     > /etc/apt/sources.list.d/google.list \
  && apt-get update \
  && apt-get install -y google-chrome-stable \
  && rm -rf /var/lib/apt/lists/*

# Puppeteer config
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install deps
COPY server/package*.json ./
RUN npm ci --only=production

# Copy server source
COPY server/ .

# Non-root user (MANDATORY for Chrome stability)
RUN groupadd -r pptruser \
  && useradd -r -g pptruser -G audio,video pptruser \
  && mkdir -p /home/pptruser/Downloads \
  && chown -R pptruser:pptruser /home/pptruser /app

USER pptruser

CMD ["node", "index.js"]
