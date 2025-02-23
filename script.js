document.addEventListener("DOMContentLoaded", function () {
    // ایجاد نقشه
    var map = L.map('map').setView([35.6892, 51.3890], 12); // تهران به عنوان نقطه شروع

    // افزودن نقشه پس‌زمینه
    var tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // لیست لایه‌ها
    var layersList = document.getElementById("layers-list");

    // لایه‌های پیش‌فرض
    var layers = {
        "buildings": "data/city1/buildings.geojson",
        "roads": "data/city1/roads.geojson",
        "water": "data/city1/water.geojson"
    };

    // ذخیره مرجع لایه‌ها
    var layerObjects = {};

    // افزودن چک‌باکس برای هر لایه
    Object.keys(layers).forEach(function (key) {
        var li = document.createElement("li");
        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = key;
        checkbox.addEventListener("change", function () {
            if (this.checked) {
                fetch(layers[key])
                    .then(response => response.json())
                    .then(data => {
                        layerObjects[key] = L.geoJSON(data).addTo(map);
                    });
            } else {
                map.removeLayer(layerObjects[key]);
            }
        });

        li.appendChild(checkbox);
        li.appendChild(document.createTextNode(key));
        layersList.appendChild(li);
    });

    // دکمه تغییر حالت تاریک
    document.getElementById("toggle-dark-mode").addEventListener("click", function () {
        document.body.classList.toggle("dark-mode");
    });
});
// متغیر برای نشانگر GPS
var userMarker = null;
var userDirection = null;

// دکمه نمایش موقعیت
document.getElementById("gps-button").addEventListener("click", function () {
    if (!navigator.geolocation) {
        alert("GPS در دستگاه شما پشتیبانی نمی‌شود.");
        return;
    }

    navigator.geolocation.watchPosition(
        function (position) {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            var heading = position.coords.heading || 0; // جهت حرکت

            // اگر نشانگر قبلاً اضافه شده بود، حذف شود
            if (userMarker) {
                map.removeLayer(userMarker);
                map.removeLayer(userDirection);
            }

            // اضافه کردن نشانگر GPS
            userMarker = L.marker([lat, lng], {
                icon: L.icon({
                    iconUrl: 'data/gps-icon.png',
                    iconSize: [25, 25]
                })
            }).addTo(map);

            // فلش جهت‌دار
            userDirection = L.polyline([
                [lat, lng],
                [lat + 0.001 * Math.cos(heading), lng + 0.001 * Math.sin(heading)]
            ], { color: 'blue' }).addTo(map);

            // زوم نکردن روی کاربر، فقط نمایش موقعیت
        },
        function (error) {
            alert("دسترسی به GPS ممکن نیست.");
        },
        { enableHighAccuracy: true, maximumAge: 1000 }
    );
});
// ذخیره نقاط جدید
var addedPoints = [];

// کلیک روی نقشه برای ثبت نقطه
map.on("click", function (e) {
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;

    document.getElementById("point-name").value = "";
    document.getElementById("point-description").value = "";

    // ذخیره مختصات آخرین نقطه کلیک شده
    lastClickedPoint = { lat: lat, lng: lng };

    alert("مختصات انتخاب شد: " + lat + ", " + lng);
});

// دکمه ثبت نقطه
document.getElementById("add-point").addEventListener("click", function () {
    var name = document.getElementById("point-name").value;
    var description = document.getElementById("point-description").value;

    if (!lastClickedPoint || !name.trim()) {
        alert("لطفاً روی نقشه کلیک کنید و نام نقطه را وارد کنید.");
        return;
    }

    // ایجاد شیء نقطه جدید
    var newPoint = {
        type: "Feature",
        properties: {
            name: name,
            description: description,
            timestamp: new Date().toISOString()
        },
        geometry: {
            type: "Point",
            coordinates: [lastClickedPoint.lng, lastClickedPoint.lat]
        }
    };

    // ذخیره در آرایه
    addedPoints.push(newPoint);

    // نمایش روی نقشه
    L.geoJSON(newPoint, {
        pointToLayer: function (feature, latlng) {
            return L.marker(latlng).bindPopup(`<b>${name}</b><br>${description}`);
        }
    }).addTo(map);

    alert("نقطه ذخیره شد!");
});
document.getElementById("save-edits").addEventListener("click", function () {
    if (addedPoints.length === 0) {
        alert("هیچ نقطه‌ای برای ذخیره وجود ندارد.");
        return;
    }

    var geojsonData = {
        type: "FeatureCollection",
        features: addedPoints
    };

    var fileName = `edits/points_${new Date().toISOString().replace(/[:.-]/g, "_")}.geojson`;
    
    var blob = new Blob([JSON.stringify(geojsonData, null, 2)], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();

    alert("فایل ذخیره شد: " + fileName);
});
var editsList = document.getElementById("edits-list");
var editHistory = []; // ذخیره ویرایش‌ها

// هر بار ذخیره، لیست آپدیت شود
function updateEditsList(fileName) {
    var li = document.createElement("li");
    li.textContent = fileName;
    
    // دکمه بارگذاری ویرایش
    var loadButton = document.createElement("button");
    loadButton.textContent = "📂 بارگذاری";
    loadButton.addEventListener("click", function () {
        loadGeoJSON(fileName);
    });

    li.appendChild(loadButton);
    editsList.appendChild(li);
}

// ذخیره تغییرات در پوشه `edits/`
document.getElementById("save-edits").addEventListener("click", function () {
    if (addedPoints.length === 0) {
        alert("هیچ نقطه‌ای برای ذخیره وجود ندارد.");
        return;
    }

    var geojsonData = {
        type: "FeatureCollection",
        features: addedPoints
    };

    var fileName = `edits/points_${new Date().toISOString().replace(/[:.-]/g, "_")}.geojson`;

    var blob = new Blob([JSON.stringify(geojsonData, null, 2)], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();

    alert("فایل ذخیره شد: " + fileName);
    updateEditsList(fileName);

    // اضافه به تاریخچه ویرایش‌ها
    editHistory.push(geojsonData);
    if (editHistory.length > 5) editHistory.shift(); // نگه‌داشتن ۵ ویرایش آخر
});

// بارگذاری لایه ذخیره‌شده
function loadGeoJSON(fileName) {
    fetch(fileName)
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.marker(latlng).bindPopup(`<b>${feature.properties.name}</b><br>${feature.properties.description}`);
                }
            }).addTo(map);
        })
        .catch(err => alert("خطا در بارگذاری فایل"));
}

// دکمه Undo برای حذف آخرین تغییر
document.getElementById("undo-edit").addEventListener("click", function () {
    if (editHistory.length === 0) {
        alert("هیچ ویرایشی برای بازگردانی وجود ندارد.");
        return;
    }

    // حذف آخرین ویرایش از نقشه
    var lastEdit = editHistory.pop();
    map.eachLayer(function (layer) {
        if (layer.feature && lastEdit.features.includes(layer.feature)) {
            map.removeLayer(layer);
        }
    });

    alert("آخرین تغییر بازگردانی شد!");
});
// تنظیم رنگ لایه‌ها در Legend
var layerColors = {
    "buildings": "red",
    "roads": "black",
    "water": "blue"
};

function updateLegend() {
    var legendDiv = document.getElementById("legend");
    legendDiv.innerHTML = ""; // پاک کردن قبلی

    Object.keys(layerColors).forEach(layer => {
        var div = document.createElement("div");
        div.classList.add("legend-item");

        var colorBox = document.createElement("div");
        colorBox.classList.add("legend-color");
        colorBox.style.backgroundColor = layerColors[layer];

        var label = document.createElement("span");
        label.textContent = layer;

        div.appendChild(colorBox);
        div.appendChild(label);
        legendDiv.appendChild(div);
    });
}

updateLegend();

// قابلیت جستجو
document.getElementById("search-button").addEventListener("click", function () {
    var query = document.getElementById("search-box").value.trim();
    if (!query) {
        alert("لطفاً نام مکان یا مختصات را وارد کنید.");
        return;
    }

    // اگر ورودی عددی باشد (X,Y)
    if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(query)) {
        var coords = query.split(",").map(Number);
        map.setView([coords[1], coords[0]], 15);
        L.marker([coords[1], coords[0]]).addTo(map).bindPopup("مختصات: " + query).openPopup();
    } else {
        // جستجو در لایه‌های GeoJSON
        var found = false;
        map.eachLayer(function (layer) {
            if (layer.feature && layer.feature.properties.name && layer.feature.properties.name.includes(query)) {
                map.setView(layer.getLatLng(), 15);
                layer.openPopup();
                found = true;
            }
        });

        if (!found) alert("مکان موردنظر یافت نشد.");
    }
});
// افزودن دو نوع نقشه پس‌زمینه
var streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
});

var satelliteMap = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Google Satellite'
});

// تنظیم نقشه پیش‌فرض
var currentBaseMap = streetMap;
streetMap.addTo(map);

// دکمه تغییر نقشه پس‌زمینه
document.getElementById("toggle-map").addEventListener("click", function () {
    if (map.hasLayer(streetMap)) {
        map.removeLayer(streetMap);
        map.addLayer(satelliteMap);
        currentBaseMap = satelliteMap;
    } else {
        map.removeLayer(satelliteMap);
        map.addLayer(streetMap);
        currentBaseMap = streetMap;
    }
});
var measurePoints = [];

// دکمه شروع اندازه‌گیری
document.getElementById("measure-start").addEventListener("click", function () {
    measurePoints = [];
    document.getElementById("measure-end").disabled = false;
    alert("روی نقشه کلیک کنید تا نقطه اول را انتخاب کنید.");
});

// دکمه پایان اندازه‌گیری
document.getElementById("measure-end").addEventListener("click", function () {
    if (measurePoints.length < 2) {
        alert("لطفاً دو نقطه را روی نقشه انتخاب کنید.");
        return;
    }

    var latlng1 = measurePoints[0];
    var latlng2 = measurePoints[1];

    var distance = map.distance(latlng1, latlng2) / 1000; // تبدیل به کیلومتر
    document.getElementById("distance-result").textContent = `فاصله: ${distance.toFixed(2)} کیلومتر`;

    L.polyline([latlng1, latlng2], { color: 'red', weight: 3 }).addTo(map);
});

// انتخاب نقاط با کلیک روی نقشه
map.on("click", function (e) {
    if (measurePoints.length < 2) {
        measurePoints.push(e.latlng);
        L.marker(e.latlng).addTo(map).bindPopup(`نقطه ${measurePoints.length}`).openPopup();

        if (measurePoints.length === 2) {
            document.getElementById("measure-end").disabled = false;
        }
    }
});
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var drawControl = new L.Control.Draw({
    edit: {
        featureGroup: drawnItems,
        remove: true
    },
    draw: {
        polyline: false,
        marker: false,
        circle: false,
        circlemarker: false,
        rectangle: false,
        polygon: {
            allowIntersection: false,
            showArea: true
        }
    }
});

document.getElementById("draw-polygon").addEventListener("click", function () {
    map.addControl(drawControl);
    alert("حالت ترسیم فعال شد! روی نقشه کلیک کنید تا چندضلعی رسم شود.");
});

// مدیریت رویداد ترسیم
map.on(L.Draw.Event.CREATED, function (event) {
    var layer = event.layer;
    drawnItems.addLayer(layer);

    // فعال‌سازی دکمه‌های ویرایش و حذف
    document.getElementById("edit-polygon").disabled = false;
    document.getElementById("delete-polygon").disabled = false;
});

// دکمه ویرایش چندضلعی
document.getElementById("edit-polygon").addEventListener("click", function () {
    if (drawnItems.getLayers().length === 0) {
        alert("هیچ چندضلعی برای ویرایش وجود ندارد.");
        return;
    }
    new L.EditToolbar.Edit(map, { featureGroup: drawnItems }).enable();
});

// دکمه حذف چندضلعی
document.getElementById("delete-polygon").addEventListener("click", function () {
    if (drawnItems.getLayers().length === 0) {
        alert("هیچ چندضلعی برای حذف وجود ندارد.");
        return;
    }
    new L.EditToolbar.Delete(map, { featureGroup: drawnItems }).enable();
});
// ذخیره چندضلعی‌ها به فرمت GeoJSON
document.getElementById("save-geojson").addEventListener("click", function () {
    var data = drawnItems.toGeoJSON();
    var jsonString = JSON.stringify(data);

    var blob = new Blob([jsonString], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `polygons_${new Date().toISOString().replace(/[:.]/g, "_")}.geojson`;
    link.click();
});

// بارگذاری چندضلعی‌ها از فایل GeoJSON
document.getElementById("geojson-file").addEventListener("change", function (event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (e) {
        var geojsonData = JSON.parse(e.target.result);
        L.geoJSON(geojsonData, {
            onEachFeature: function (feature, layer) {
                drawnItems.addLayer(layer);
            }
        }).addTo(map);
        alert("چندضلعی‌ها بارگذاری شدند!");
    };
    reader.readAsText(file);
});
var selectedPolygon = null;

// نمایش اطلاعات هنگام کلیک روی چندضلعی
map.on("click", function (e) {
    map.eachLayer(function (layer) {
        if (layer instanceof L.Polygon && layer.contains(e.latlng)) {
            selectedPolygon = layer;
            var info = layer.feature ? layer.feature.properties.description || "" : "";
            document.getElementById("polygon-info").value = info;
            document.getElementById("save-info").disabled = false;
        }
    });
});

// ذخیره توضیحات در ویژگی‌های چندضلعی
document.getElementById("save-info").addEventListener("click", function () {
    if (!selectedPolygon) return;

    var newInfo = document.getElementById("polygon-info").value;
    if (!selectedPolygon.feature) {
        selectedPolygon.feature = { type: "Feature", properties: {} };
    }
    selectedPolygon.feature.properties.description = newInfo;
    alert("توضیحات ذخیره شد!");
});