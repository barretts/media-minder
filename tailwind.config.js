/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          50: "#e8f4f8",
          100: "#d0e8f0",
          200: "#a8d0e0",
          300: "#7ab8cc",
          400: "#4e9ab4",
          500: "#2d7a96",
          600: "#1d5f78",
          700: "#144960",
          800: "#0d3347",
          900: "#071e2e",
          950: "#040f18",
        },
        sol: {
          accent: "#00b4d8",
          highlight: "#48cae4",
          muted: "#0077a8",
          raised: "#1a6580",
          border: "#1d7fa0",
          borderdark: "#0a3d52",
          text: "#cce8f0",
          textdim: "#7ab8cc",
          textfaint: "#4e7e96",
          orange: "#e07c30",
          orangedim: "#a05520",
        },
      },
    },
  },
  plugins: [],
};
