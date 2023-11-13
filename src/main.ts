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

const gameBoard = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
    center: MERRILL_CLASSROOM,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false,
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

const coinPurse: Coin[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

const pitList = new Map<Cell, Coin[]>();

function objToString(obj: Coin[]): string {
    let coinList = "";
    for (const obje of obj) {
        coinList += `${obje.origin.i},${obje.origin.j},#${obje.serialNumber} \n`;
    }
    return coinList;
}

function makePit(i: number, j: number) {
    const currCell: Cell = { i: i, j: j };
    const pitCoinList: Coin[] = [];
    const pit = leaflet.rectangle(gameBoard.getCellBounds(currCell)) as leaflet.Layer;
    for (let ii = 0; ii < Math.floor(luck([i, j, "initialValue"].toString()) * 10); ii++){
        const nCoin: Coin = { origin: currCell, serialNumber: ii };
        pitCoinList.push(nCoin);
    }


    pit.bindPopup(() => {
        const container = document.createElement("div");
        container.innerHTML = `
                <div>There is a pit here at "${i},${j}". It has this many coins: <span id="value">${pitCoinList.length}${objToString(pitCoinList)}</span>.</div>
                <button id="poke">Collect Coin</button><button id="unpoke">Deposit Coin</button>`;
        const poke = container.querySelector<HTMLButtonElement>("#poke")!;
        

        poke.addEventListener("click", () => {
            if (pitCoinList.length > 0) {
                const poppedCoin = pitCoinList.pop();
                coinPurse.push(poppedCoin!);
                console.log(poppedCoin);
            }
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = objToString(pitCoinList);
            statusPanel.innerHTML = `${objToString(coinPurse)} coins collected!`;
        });
        const unpoke = container.querySelector<HTMLButtonElement>("#unpoke")!;
        unpoke.addEventListener("click", () => {
            if (coinPurse.length > 0) {
                const pushedCoin = coinPurse.pop();
                console.log(pushedCoin);
                pitCoinList.push(pushedCoin!);
            }
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = objToString(pitCoinList);
            statusPanel.innerHTML = `${objToString(coinPurse)} coins collected!`;
        });
        return container;
    });
    pitList.set(currCell,pitCoinList);
    pit.addTo(map);
}

for (const { i, j } of gameBoard.getCellsNearPoint(playerMarker.getLatLng())) {
    if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
        makePit(i, j);
    }
}