import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { latLng } from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board.ts";
import { Cell } from "./board.ts";

interface Coin{
    origin: Cell;
    serialNumber: number;
}

const MERRILL_CLASSROOM = leaflet.latLng({
    lat: 36.9995,
    lng: - 122.0533
});

const GAMEPLAY_ZOOM_LEVEL = 18;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
    center: MERRILL_CLASSROOM,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
}).addTo(map);

const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip(`That's you! Your location is ${MERRILL_CLASSROOM.lat},${MERRILL_CLASSROOM.lng}`);
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
  });
});

let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

function makePit(i: number, j: number) {
    const bounds = leaflet.latLngBounds([
        [MERRILL_CLASSROOM.lat + i * TILE_DEGREES,
        MERRILL_CLASSROOM.lng + j * TILE_DEGREES],
        [MERRILL_CLASSROOM.lat + (i + 1) * TILE_DEGREES,
        MERRILL_CLASSROOM.lng + (j + 1) * TILE_DEGREES],
    ]);

    const pit = leaflet.rectangle(bounds) as leaflet.Layer;



    pit.bindPopup(() => {
        let value = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
        const container = document.createElement("div");
        container.innerHTML = `
                <div>There is a pit here at "${i},${j}". It has this many coins: <span id="value">${value}</span>.</div>
                <button id="poke">Collect Coin</button><button id="unpoke">Deposit Coin</button>`;
        const poke = container.querySelector<HTMLButtonElement>("#poke")!;
        poke.addEventListener("click", () => {
            if (value > 0) {
                value--;
                points++;
            }
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = value.toString();
            statusPanel.innerHTML = `${points} coins collected!`;
        });
        const unpoke = container.querySelector<HTMLButtonElement>("#unpoke")!;
        unpoke.addEventListener("click", () => {
            if (points > 0) {
                value++;
                points--;
            }
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = value.toString();
            statusPanel.innerHTML = `${points} coins collected!`;
        });
        return container;
    });
    pit.addTo(map);
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = - NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
            makePit(i, j);
        }
    }
}
//add a tooltip so when you click on the player, the player's latitude longitude is displayed
//each pit = 1 cell
//"nearby cells" are cells within an 8 cell radius of the player
//10 percent of grid cells "nearby" the player will be pits
//player is stationary for now
//pick up coins AND deposit, right now theres on'y a pickup function
//make sure you can't poke pits beyond 0, or deposit beyond 0