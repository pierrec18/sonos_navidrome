FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY wsdl ./wsdl
RUN npm run build
EXPOSE 4000
CMD ["npm","start"]
