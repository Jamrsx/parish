/** @type {import('tailwindcss').Config} */
module.exports = {
content: [
"./components/**/*.{js,jsx,ts,tsx}"
,
"./app/**/*.{js,jsx,ts,tsx}"
,
],
presets: [require("nativewind/preset")],
theme: {
extend: {
screens: {
sm: '380px',
md: '768px',
lg: '1024px',
},
},
},
plugins: [],
};