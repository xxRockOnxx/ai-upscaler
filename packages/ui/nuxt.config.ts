// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // SPA — no server-side rendering (static generate)
  ssr: false,

  devServer: {
    host: "0.0.0.0",
    port: 3001,
  },

  app: {
    head: {
      title: "Free Online AI Video Upscaler",
      htmlAttrs: {
        lang: "en",
      },
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          key: "description",
          name: "description",
          content:
            "Enhance low resolution videos to 4x of the original size with the power of AI for free.",
        },
        { name: "format-detection", content: "telephone=no" },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap",
        },
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      ],
    },
  },

  modules: ["@nuxtjs/tailwindcss", "@nuxt/eslint"],

  // Dev-only: proxy /api to the local backend, stripping the /api prefix
  // (matches the previous @nuxtjs/axios proxy behaviour). Production uses
  // the redirect in netlify.toml.
  routeRules: {
    "/api/**": { proxy: "http://localhost:3000/**" },
  },
});
