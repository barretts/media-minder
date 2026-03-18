/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          50: "#f0eff8",
          100: "#dfdeef",
          200: "#bebebe",
          300: "#adb5c6",
          400: "#9090a8",
          500: "#6b6b8a",
          600: "#524a8c",
          700: "#3d3670",
          800: "#31315a",
          900: "#29294a",
          950: "#1a1a30",
        },
        sol: {
          widget: "#bebebe",
          widgetdark: "#adb5c6",
          titleactive: "#847bbd",
          titleinactive: "#524a8c",
          desktop: "#adb5c6",
          panel: "#29294a",
          panelmid: "#31315a",
          text: "#000000",
          textlight: "#ffffff",
          textdim: "#333333",
          textpanel: "#e8e8f8",
          bevellight: "#ffffff",
          bevelmid: "#dfdfdf",
          beveldark: "#808080",
          bevelblack: "#404040",
          select: "#000080",
          selecttext: "#ffffff",
          red: "#cc2222",
        },
      },
    },
  },
  plugins: [],
};
