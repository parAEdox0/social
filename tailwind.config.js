/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views"],
  theme: {
    extend: {},
    fontFamily: {
      poppins: ["Poppins"]
    }
  },
  plugins: [
    require("tailwind-scrollbar-hide")
  ],
}

