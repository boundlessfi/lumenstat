FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src ./src
USER node
EXPOSE 3100 3101
CMD ["node", "--require", "./src/instrument.cjs", "src/app.cjs"]
