// --- CONFIGURATION & STATE ---
// using Basmilius Weather Icons (Colorful & Flat)
const weatherCodes = {
    0: { text: "Clear Sky", img: "clear-day" },
    1: { text: "Mainly Clear", img: "partly-cloudy-day" },
    2: { text: "Partly Cloudy", img: "partly-cloudy-day" },
    3: { text: "Overcast", img: "overcast" },
    45: { text: "Fog", img: "fog" },
    48: { text: "Rime Fog", img: "fog" },
    51: { text: "Light Drizzle", img: "drizzle" },
    53: { text: "Drizzle", img: "drizzle" },
    55: { text: "Heavy Drizzle", img: "overcast-drizzle" },
    61: { text: "Slight Rain", img: "rain" },
    63: { text: "Rain", img: "rain" },
    65: { text: "Heavy Rain", img: "thunderstorms-rain" },
    71: { text: "Light Snow", img: "snow" },
    73: { text: "Snow", img: "snow" },
    75: { text: "Heavy Snow", img: "thunderstorms-snow" },
    80: { text: "Slight Showers", img: "rain" },
    81: { text: "Showers", img: "rain" },
    82: { text: "Heavy Showers", img: "thunderstorms-rain" },
    85: { text: "Snow Showers", img: "snow" },
    86: { text: "Heavy Snow Showers", img: "thunderstorms-snow" },
    95: { text: "Thunderstorm", img: "thunderstorms" },
    96: { text: "Thunderstorm & Hail", img: "thunderstorms-snow" },
    'default': { text: "Unknown", img: "not-available" }
};

let hourlyChartJs = null;
let currentLat = 51.5074; // London default
let currentLon = -0.1278;
let currentLocationName = "London";

// --- MAP VARIABLES (Moved to Global Scope) ---
let map = null;
let marker = null;


// --- THEME TOGGLE LOGIC ---
function toggleTheme() {
    const body = document.body;
    const btnIcon = document.querySelector('#theme-toggle i');
    
    // Toggle class
    body.classList.toggle('dark-mode');
    
    // Check if dark mode is now active
    const isDarkMode = body.classList.contains('dark-mode');
    
    // Update Icon
    if(isDarkMode) {
        btnIcon.classList.remove('fa-moon');
        btnIcon.classList.add('fa-sun');
    } else {
        btnIcon.classList.remove('fa-sun');
        btnIcon.classList.add('fa-moon');
    }

    // Update Chart colors
    if(hourlyChartJs) {
        updateChartTheme(isDarkMode);
    }
}

function updateChartTheme(isDark) {
    const textColor = isDark ? '#a0a0a0' : '#7f8c8d';
    const gridColor = isDark ? '#333' : '#e1e4e8';
    
    hourlyChartJs.options.scales.x.ticks.color = textColor;
    hourlyChartJs.options.scales.x.grid.display = false;
    hourlyChartJs.options.scales.y.ticks.color = textColor;
    hourlyChartJs.options.scales.y.grid.color = gridColor;
    hourlyChartJs.update();
}


// --- API FUNCTIONS ---
function getWeatherInfo(code) {
    return weatherCodes[code] || weatherCodes['default'];
}

async function handleSearch() {
    const searchInput = document.getElementById('search-input').value;
    if (!searchInput) return;

    try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${searchInput}&count=1&language=en&format=json`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            currentLat = data.results[0].latitude;
            currentLon = data.results[0].longitude;
            currentLocationName = data.results[0].name + (data.results[0].country_code ? `, ${data.results[0].country_code}` : '');
            document.getElementById('search-input').value = '';
            fetchData();
        } else {
            alert("City not found.");
        }
    } catch (error) {
        console.error("Geocoding error:", error);
    }
}

async function fetchData() {
    document.getElementById('location-name').innerText = currentLocationName;
    const now = new Date();
    document.getElementById('current-date').innerText = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${currentLat}&longitude=${currentLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&hourly=temperature_2m,weather_code,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset&timezone=auto`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${currentLat}&longitude=${currentLon}&current=european_aqi`;

    try {
        const [weatherRes, aqiRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)]);
        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();
        
        updateUI(weatherData, aqiData);
        
        // Map initialization called AFTER data is ready
        initMap(currentLat, currentLon);
        
    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById('location-name').innerText = "Error loading data";
    }
}

function updateUI(wData, aData) {
    const current = wData.current;
    const daily = wData.daily;
    const hourly = wData.hourly;

    // 1. LEFT COLUMN: Current Weather
    const currentInfo = getWeatherInfo(current.weather_code);
    document.getElementById('current-icon').innerHTML = `
        <img src="https://basmilius.github.io/weather-icons/production/fill/all/${currentInfo.img}.svg" alt="${currentInfo.text}" class="weather-img-lg">
    `;

    document.getElementById('current-temp').innerText = Math.round(current.temperature_2m) + "°";
    document.getElementById('current-text').innerText = currentInfo.text;
    document.getElementById('today-high').innerText = Math.round(daily.temperature_2m_max[0]);
    document.getElementById('today-low').innerText = Math.round(daily.temperature_2m_min[0]);

    // 2. LEFT COLUMN: Sunrise & Sunset
    const formatTime = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    document.getElementById('left-sunrise').innerText = formatTime(daily.sunrise[0]);
    document.getElementById('left-sunset').innerText = formatTime(daily.sunset[0]);

    // 3. MIDDLE COLUMN: Highlights
    
    // UV Index
    const uv = daily.uv_index_max[0];
    const uvStatus = getStatus('uv', uv);
    document.getElementById('hl-uv').innerText = `${uv.toFixed(1)} (${uvStatus})`;

    // Wind Status
    const wind = current.wind_speed_10m;
    const windStatus = getStatus('wind', wind);
    document.getElementById('hl-wind').innerText = `${wind} km/h (${windStatus})`;

    // Humidity
    const humidity = current.relative_humidity_2m;
    const humidityStatus = getStatus('humidity', humidity);
    document.getElementById('hl-humidity').innerText = `${humidity}% (${humidityStatus})`;

    // Visibility (Convert meters to km)
    const visibilityKm = (hourly.visibility[0] / 1000).toFixed(1); 
    const visStatus = getStatus('visibility', visibilityKm);
    document.getElementById('hl-visibility').innerText = `${visibilityKm} km (${visStatus})`;

    // Rain (No status needed usually, "0mm" is clear enough)
    document.getElementById('hl-precip').innerText = current.precipitation + " mm";
    
    // Air Quality 
    let aqiValue = aData.current ? aData.current.european_aqi : "N/A";
    let aqiText = aqiValue <= 20 ? "Good" : aqiValue <= 40 ? "Fair" : aqiValue <= 60 ? "Moderate" : "Poor";
    document.getElementById('hl-aqi').innerText = `${aqiValue} (${aqiText})`;

    // Render Chart
    renderChart(hourly.time, hourly.temperature_2m);

    // 4. RIGHT COLUMN: 7-Day Forecast
    const forecastContainer = document.getElementById('forecast-list-container');
    forecastContainer.innerHTML = ''; 

    for(let i = 0; i < 7; i++) {
        const date = new Date(daily.time[i]);
        const dayName = i === 0 ? "Today" : date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayInfo = getWeatherInfo(daily.weather_code[i]);
        const max = Math.round(daily.temperature_2m_max[i]);
        const min = Math.round(daily.temperature_2m_min[i]);

        const itemHTML = `
         <div class="forecast-item">
            <span class="forecast-day">${dayName}</span>
            <span class="forecast-icon">
                <img src="https://basmilius.github.io/weather-icons/production/fill/all/${dayInfo.img}.svg" alt="${dayInfo.text}" class="weather-img-sm">
            </span>
            <div class="forecast-temps">${max}° <span class="temp-min">${min}°</span></div>
        </div>
        `;
        forecastContainer.innerHTML += itemHTML;
    }
}

// --- STATUS CALCULATOR HELPERS ---
function getStatus(type, value) {
    if (type === 'uv') {
        if (value <= 2) return "Low";
        if (value <= 5) return "Moderate";
        if (value <= 7) return "High";
        if (value <= 10) return "Very High";
        return "Extreme";
    } 
    else if (type === 'wind') {
        // km/h
        if (value <= 10) return "Calm";
        if (value <= 20) return "Light Breeze";
        if (value <= 40) return "Moderate";
        if (value <= 60) return "Strong";
        return "Gale";
    }
    else if (type === 'humidity') {
        if (value <= 30) return "Dry";
        if (value <= 60) return "Comfortable";
        return "Humid";
    }
    else if (type === 'visibility') {
        // km
        if (value >= 10) return "Clear";
        if (value >= 5) return "Good";
        if (value >= 2) return "Fair";
        return "Poor (Fog)";
    }
    return "";
}

function renderChart(times, temps) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    const next24HoursLabels = times.slice(0, 25).map(timeStr => {
        const date = new Date(timeStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    const next24HoursData = temps.slice(0, 25);

    if (hourlyChartJs) {
        hourlyChartJs.destroy();
    }

    const isDarkMode = document.body.classList.contains('dark-mode');
    const textColor = isDarkMode ? '#a0a0a0' : '#7f8c8d';
    const gridColor = isDarkMode ? '#333' : '#e1e4e8';

    let gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(77, 171, 247, 0.5)'); 
    gradient.addColorStop(1, 'rgba(77, 171, 247, 0)');

    hourlyChartJs = new Chart(ctx, {
        type: 'line',
        data: {
            labels: next24HoursLabels,
            datasets: [{
                label: 'Temperature (°C)',
                data: next24HoursData,
                borderColor: '#4dabf7',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: 0, 
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, maxTicksLimit: 6 }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor },
                    beginAtZero: false
                }
            }
        }
    });
}

// --- INITIALIZE MAP FUNCTION (Moved outside renderChart) ---
function initMap(lat, lon) {
    // If map already exists, just fly to the new location
    if (map) {
        map.flyTo([lat, lon], 10); 
        marker.setLatLng([lat, lon]);
        return;
    }

    // Create Map
    map = L.map('map', { 
        zoomControl: false, 
        attributionControl: false 
    }).setView([lat, lon], 10);

    // Add OpenStreetMap Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);

    // Add Marker
    marker = L.marker([lat, lon]).addTo(map);


// --- AUTO-SUGGESTION LOGIC ---

const searchInput = document.getElementById('search-input');
const suggestionsBox = document.getElementById('suggestions-box');
let debounceTimer; // Timer to wait for user to stop typing

// 1. Listen for typing in the search box
searchInput.addEventListener('input', function() {
    const query = this.value.trim();

    // Clear any previous timer (reset the clock)
    clearTimeout(debounceTimer);

    // If input is empty, hide the box
    if (query.length < 2) {
        suggestionsBox.style.display = 'none';
        return;
    }

    // Set a new timer: Wait 300ms, then fetch
    debounceTimer = setTimeout(() => {
        fetchCitySuggestions(query);
    }, 300);
});

// 2. Fetch data from Geocoding API
async function fetchCitySuggestions(query) {
    try {
        // We ask for 5 results
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=5&language=en&format=json`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.results) {
            showSuggestions(data.results);
        } else {
            suggestionsBox.style.display = 'none';
        }
    } catch (error) {
        console.error("Error fetching suggestions:", error);
    }
}

// 3. Render the list in HTML
function showSuggestions(cities) {
    suggestionsBox.innerHTML = ''; // Clear old results
    suggestionsBox.style.display = 'block'; // Show the box

    cities.forEach(city => {
        const item = document.createElement('div');
        item.classList.add('suggestion-item');
        
        // Format: "London" + "GB" (Country Code)
        // You can also add "admin1" (Region) if you want: city.admin1
        const locationText = `${city.name}`;
        const regionText = city.admin1 ? `, ${city.admin1}` : '';
        const countryText = city.country ? `${city.country}` : '';
        
        item.innerHTML = `
            <span>${locationText}<span style="font-size:0.8em; color:var(--text-secondary)">${regionText}</span></span>
            <span class="flag-code">${city.country_code}</span>
        `;

        // When user clicks a suggestion
        item.addEventListener('click', () => {
            selectCity(city);
        });

        suggestionsBox.appendChild(item);
    });
}

// 4. Handle Selection
function selectCity(city) {
    // Update Global Variables
    currentLat = city.latitude;
    currentLon = city.longitude;
    currentLocationName = `${city.name}, ${city.country_code}`;
    
    // Update UI
    searchInput.value = city.name; // Put name in box
    suggestionsBox.style.display = 'none'; // Hide list
    
    // Trigger main weather fetch
    fetchData();
}

// 5. Close list if clicking outside
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
        suggestionsBox.style.display = 'none';
    }
});
}

// Start App
fetchData();