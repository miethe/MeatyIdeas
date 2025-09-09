FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.10.0 --activate

COPY package.json pnpm-lock.yaml* .npmrc* .yarnrc* tsconfig.json next.config.mjs postcss.config.js tailwind.config.ts /app/
COPY app /app/app
#COPY public /app/public

RUN pnpm install --frozen-lockfile || pnpm install

EXPOSE 3000

CMD ["pnpm", "dev"]

