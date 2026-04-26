**current weather by latitude & longitude**  

const http \= require('https');

const options \= {  
	method: 'GET',  
	hostname: 'open-weather13.p.rapidapi.com',  
	port: null,  
	path: '/latlon?latitude=40.730610\&longitude=-73.935242\&lang=EN',  
	headers: {  
		'x-rapidapi-key': 'c681296a52mshc2c73586baf893bp135671jsn76eb375db9e7',  
		'x-rapidapi-host': 'open-weather13.p.rapidapi.com'  
	}  
};

const req \= http.request(options, function (res) {  
	const chunks \= \[\];

	res.on('data', function (chunk) {  
		chunks.push(chunk);  
	});

	res.on('end', function () {  
		const body \= Buffer.concat(chunks);  
		console.log(body.toString());  
	});  
});

req.end();

Forecast 5 days 

const http \= require('https');

const options \= {  
	method: 'GET',  
	hostname: 'open-weather13.p.rapidapi.com',  
	port: null,  
	path: '/fivedaysforcast?latitude=40.730610\&longitude=-73.935242\&lang=EN',  
	headers: {  
		'x-rapidapi-key': 'c681296a52mshc2c73586baf893bp135671jsn76eb375db9e7',  
		'x-rapidapi-host': 'open-weather13.p.rapidapi.com'  
	}  
};

const req \= http.request(options, function (res) {  
	const chunks \= \[\];

	res.on('data', function (chunk) {  
		chunks.push(chunk);  
	});

	res.on('end', function () {  
		const body \= Buffer.concat(chunks);  
		console.log(body.toString());  
	});  
});

req.end();

# API Overview

Get real-time weather data for any location worldwide\! We gather and analyze information from a wide range of sources, including global and local weather models, satellites, radars, and an extensive network of weather stations.  
*Get real-time weather data for any location worldwide\! We gather and analyze information from a wide range of sources, including global and local weather models, satellites, radars, and an extensive network of weather stations.*  
\<h2\>API response fields\</h2\>  
coord

* coord.lon Longitude of the location  
* coord.lat Latitude of the location

weather 

* weather.id Weather condition id  
* weather.main Group of weather parameters (Rain, Snow, Clouds etc.)  
* weather.description Weather condition within the group  
* weather.icon Weather icon id. https://openweather.site/img/wn/{weather.icon}.png \<br /\>Example: [https://openweather.site/img/wn/01d.png](https://openweather.site/img/wn/01d.png)

base Internal parameter

main

* main.temp Temperature. Unit Default: Kelvin, Metric: Celsius, Imperial: Fahrenheit  
* main.feels\_like Temperature. This temperature parameter accounts for the human perception of weather. Unit Default: Kelvin, Metric: Celsius, Imperial: Fahrenheit  
* main.pressure Atmospheric pressure on the sea level, hPa  
* main.humidity Humidity, %  
* main.temp\_min Minimum temperature at the moment. This is minimal currently observed temperature (within large megalopolises and urban areas). Unit Default: Kelvin, Metric: Celsius, Imperial: Fahrenheit  
* main.temp\_max Maximum temperature at the moment. This is maximal currently observed temperature (within large megalopolises and urban areas). Unit Default: Kelvin, Metric: Celsius, Imperial: Fahrenheit  
* main.sea\_level Atmospheric pressure on the sea level, hPa  
* main.grnd\_level Atmospheric pressure on the ground level, hPa

visibility Visibility, meter. The maximum value of the visibility is 10 km

wind

* wind.speed Wind speed. Unit Default: meter/sec, Metric: meter/sec, Imperial: miles/hour  
* wind.deg Wind direction, degrees (meteorological)  
* wind.gust Wind gust. Unit Default: meter/sec, Metric: meter/sec, Imperial: miles/hour

clouds

* clouds.all Cloudiness, %

rain

* rain.1h *(where available)* Rain volume for the last 1 hour, mm. Please note that only mm as units of measurement are available for this parameter  
* rain.3h *(where available)* Rain volume for the last 3 hours, mm. Please note that only mm as units of measurement are available for this parameter

snow

* snow.1h *(where available)* Snow volume for the last 1 hour, mm. Please note that only mm as units of measurement are available for this parameter  
* snow.3h *(where available)* Snow volume for the last 3 hours, mm. Please note that only mm as units of measurement are available for this parameter

dt Time of data calculation, unix, UTC

sys

* sys.type Internal parameter  
* sys.id Internal parameter  
* sys.message Internal parameter  
* sys.country ountry code (GB, JP etc.)  
* sys.sunrise Sunrise time, unix, UTC  
* sys.sunset Sunset time, unix, UTC

timezone Shift in seconds from UTC id City ID name City name cod Internal parameter"  
