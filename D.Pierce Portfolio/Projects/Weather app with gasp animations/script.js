/* Weather Oracle: Blue Edition by Donzie Pierce
   Now with Fahrenheit / Celsius toggle support
*/

const cityInput = document.getElementById("cityInput");
const searchForm = document.getElementById("searchForm");
const weatherInfo = document.getElementById("weatherInfo");
const errorBox = document.getElementById("errorBox");
const unitToggle = document.getElementById("unitToggle");

const locationEl = document.getElementById("location");
const temperatureEl = document.getElementById("temperature");
const conditionEl = document.getElementById("condition");
const feelsEl = document.getElementById("feelsLike");
const humidEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const iconEl = document.getElementById("weatherIcon");
const forecastEl = document.getElementById("forecast");

const bg = document.getElementById("bgCanvas");
const ctx = bg.getContext("2d");
let w,h;
function resize(){w=bg.width=innerWidth;h=bg.height=innerHeight;}
window.addEventListener("resize",resize);resize();

let gradShift = 0;
function drawBg(){
  const gradient = ctx.createLinearGradient(0, gradShift, 0, h);
  gradient.addColorStop(0, "#0a2a66");
  gradient.addColorStop(1, "#092f8e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,w,h);
  gradShift += 0.4;
  requestAnimationFrame(drawBg);
}
drawBg();

let currentCity = null;
let isFahrenheit = false;

// Event: Search for city
searchForm.addEventListener("submit", async e=>{
  e.preventDefault();
  const city = cityInput.value.trim();
  if(!city) return;
  currentCity = city;
  await fetchWeather(city);
});

// Event: Toggle units
unitToggle.addEventListener("change", async ()=>{
  isFahrenheit = unitToggle.checked;
  if(currentCity){
    await fetchWeather(currentCity);
  }
});

async function fetchWeather(city){
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    if(!geoData.results) throw new Error("No city found");
    const { latitude, longitude, name, country } = geoData.results[0];

    const unitParam = isFahrenheit ? "fahrenheit" : "celsius";
    const windUnit = isFahrenheit ? "mph" : "kmh";

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=${unitParam}&wind_speed_unit=${windUnit}&timezone=auto`);
    const data = await res.json();
    showWeather(name, country, data, unitParam);
  } catch(err) {
    showError();
  }
}

function showWeather(name, country, data, unitParam){
  errorBox.hidden = true;
  weatherInfo.hidden = false;

  const cur = data.current;
  const icon = codeToIcon(cur.weather_code);
  locationEl.textContent = `${name}, ${country}`;
  const symbol = unitParam === "fahrenheit" ? "°F" : "°C";
  temperatureEl.textContent = `${Math.round(cur.temperature_2m)}${symbol}`;
  conditionEl.textContent = codeToText(cur.weather_code);
  feelsEl.textContent = `${Math.round(cur.apparent_temperature)}${symbol}`;
  humidEl.textContent = Math.round(cur.relative_humidity_2m);
  windEl.textContent = `${Math.round(cur.wind_speed_10m)} ${isFahrenheit ? "mph" : "km/h"}`;
  iconEl.textContent = icon;

  // Animate transitions
  gsap.from(".glass", { duration: 1, y: 20, opacity: 0, ease: "power2.out" });
  gsap.from(".forecast .card", { duration: 1, y: 30, opacity: 0, stagger: 0.1, ease: "power2.out" });

  const color = weatherColor(cur.weather_code);
  gsap.to("body", { backgroundColor: color.main, duration: 2 });
  gsap.to(bg, { opacity: color.glow, duration: 2 });

  // Forecast
  forecastEl.innerHTML = "";
  const days = data.daily;
  for(let i=0;i<days.time.length;i++){
    const div = document.createElement("div");
    div.className="card";
    div.innerHTML = `
      <div>${new Date(days.time[i]).toLocaleDateString(undefined,{weekday:"short"})}</div>
      <div style="font-size:1.5rem;">${codeToIcon(days.weather_code[i])}</div>
      <div>${Math.round(days.temperature_2m_max[i])}${symbol} / ${Math.round(days.temperature_2m_min[i])}${symbol}</div>
    `;
    forecastEl.appendChild(div);
  }
}

function showError(){
  weatherInfo.hidden = true;
  errorBox.hidden = false;
}

function codeToIcon(code){
  if([0].includes(code)) return "☀️";
  if([1,2].includes(code)) return "🌤️";
  if([3].includes(code)) return "☁️";
  if([45,48].includes(code)) return "🌫️";
  if([51,53,55].includes(code)) return "🌦️";
  if([61,63,65,80,81,82].includes(code)) return "🌧️";
  if([71,73,75,77,85,86].includes(code)) return "❄️";
  if([95,96,99].includes(code)) return "⛈️";
  return "🌡️";
}

function codeToText(code){
  const m = {
    0:"Clear Sky",1:"Mainly Clear",2:"Partly Cloudy",3:"Overcast",
    45:"Foggy",48:"Dense Fog",51:"Light Drizzle",53:"Moderate Drizzle",55:"Heavy Drizzle",
    61:"Light Rain",63:"Moderate Rain",65:"Heavy Rain",71:"Light Snow",73:"Moderate Snow",
    75:"Heavy Snow",77:"Snow Grains",80:"Light Showers",81:"Moderate Showers",
    82:"Heavy Showers",95:"Thunderstorm",96:"Storm + Hail",99:"Severe Thunderstorm"
  };
  return m[code] || "Unknown";
}

function weatherColor(code){
  if([0,1].includes(code)) return { main:"#0a4aa8", glow:1 };
  if([2,3].includes(code)) return { main:"#0a3e7a", glow:0.8 };
  if([61,63,65,80,81,82].includes(code)) return { main:"#072e54", glow:0.6 };
  if([71,73,75,77,85,86].includes(code)) return { main:"#0c558a", glow:0.7 };
  if([95,96,99].includes(code)) return { main:"#1b274a", glow:0.5 };
  return { main:"#09336e", glow:0.8 };
}