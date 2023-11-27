import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board.ts";
import { Cell } from "./board.ts";

/*interface Coin{
    origin: Cell;
    serialNumber: number;
}*/
class Coin {
    constructor(readonly origin: Cell, readonly serialNumber: number) {}
  }

const MERRILL_CLASSROOM = leaflet.latLng({
    lat: 36.9995,
    lng: - 122.0533
});
const NULL_ISLAND = {
    lat: 0,
    lng: 0,
  };
interface Momento<T>{
    toMomento(): T;
    fromMomento(momento: T): void;
}

class Geocache implements Momento<string>{
    cell: Cell;
    coins: Coin[];
    constructor(cell: Cell, ) {
        
        this.cell = cell;
        this.coins = [];
        for (let ij = 0; ij < Math.floor(luck([cell.i, cell.j, "initialValue"].toString()) * 10); ij++){
            const pushCoin: Coin = { origin: cell, serialNumber: ij };
            this.coins.push(pushCoin);
        }
    }

    fromMomento(momento: string) {
        this.coins = JSON.parse(momento) as Coin[];
    }
    toMomento() {
        return JSON.stringify(this.coins);
    }
}


const GAMEPLAY_ZOOM_LEVEL = 18;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const gameBoard = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

const mapContainer = document.querySelector<HTMLElement>("#map")!;


const map = leaflet.map(mapContainer, {
    center: NULL_ISLAND,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false,
});

let movementHistory: leaflet.LatLng[] = [];
let polylineArray: leaflet.Polyline[] = [];
let polylineHistory = leaflet.polyline(movementHistory, { color: "green" });
polylineArray.push(polylineHistory);


leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
}).addTo(map);

const playerMarker = leaflet.marker(NULL_ISLAND);
playerMarker.bindTooltip(`That's you! Your location is ${MERRILL_CLASSROOM.lat},${MERRILL_CLASSROOM.lng}`);
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
const leftButton = document.querySelector("#west");
const rightButton = document.querySelector("#east");
const upButton = document.querySelector("#north");
const downButton = document.querySelector("#south");
const resetButton = document.querySelector("#reset");
  
sensorButton.addEventListener("click", buttonz);
leftButton?.addEventListener("click", buttonz);
rightButton?.addEventListener("click", buttonz);
upButton?.addEventListener("click", buttonz);
downButton?.addEventListener("click", buttonz);
resetButton?.addEventListener("click", buttonz);

function buttonz(event: Event) {
    const target = event.target as HTMLElement;
    const playerLatLng = playerMarker.getLatLng();
    switch (target.id) {
        case "west":
            playerLatLng.lng -= TILE_DEGREES;
            playerMarker.setLatLng(playerLatLng);
            addPointtoPolyline(playerMarker.getLatLng().lat, playerMarker.getLatLng().lng);
            break;
        case "east":
            playerLatLng.lng += TILE_DEGREES;
            playerMarker.setLatLng(playerLatLng);
            addPointtoPolyline(playerMarker.getLatLng().lat, playerMarker.getLatLng().lng);
            break;
        case "north":
            playerLatLng.lat += TILE_DEGREES;
            playerMarker.setLatLng(playerLatLng);
            addPointtoPolyline(playerMarker.getLatLng().lat, playerMarker.getLatLng().lng);
            break;
        case "south":
            playerLatLng.lat -= TILE_DEGREES;
            playerMarker.setLatLng(playerLatLng);
            addPointtoPolyline(playerMarker.getLatLng().lat, playerMarker.getLatLng().lng);
            break;
        case "sensor":
            navigator.geolocation.watchPosition((position) => {
                playerMarker.setLatLng(
                    leaflet.latLng(position.coords.latitude, position.coords.longitude)
                ),
                map.setView(playerMarker.getLatLng()),
                { enableHighAccuracy: true },
                addPointtoPolyline(playerMarker.getLatLng().lat, playerMarker.getLatLng().lng);
                drawPolylines();
                clearCaches();
                spawnPits();
            });
            break;
        case "reset": {
            const confirmReset = window.confirm(`Are you sure you want to reset?`);
            if (confirmReset) {
                playerMarker.setLatLng(NULL_ISLAND);
                movementHistory = [];
                for (const line of polylineArray) {
                    line.remove();
                }
                knownList.clear();
                polylineArray = [];
                coinPurse = [];
                saveCoinState();
                statusPanel.innerHTML = `Coin Inventory: ${objToString(coinPurse)} \n`;
            }  else {
                break;
            }
            break;
        }
    }
    map.setView(playerMarker.getLatLng());
    clearCaches();
    drawPolylines();
    spawnPits();
}

let coinPurse: Coin[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";


const knownList = new Map<Cell, string>();
const tempCaches: leaflet.Rectangle[] = [];


function objToString(obj: Coin[]): string {
    let coinList = "";
    for (const obje of obj) {
        coinList += `${obje.origin.i},${obje.origin.j},#${obje.serialNumber} \n`;
    }
    return coinList;
}


function makePit(cell: Cell) {
    //const existingCell = gameBoard.getCellForPoint(leaflet.latLng({ lat: cell.i, lng: cell.j }));
    const pit = leaflet.rectangle(gameBoard.getCellBounds(cell));
    const geocache = new Geocache(cell);
        if (knownList.has(cell)) {
            geocache.fromMomento(knownList.get(cell)!);
        } else {
            knownList.set(cell, geocache.toMomento());
        }
    
    const pitCoinList = geocache.coins;
    pit.bindPopup(() => {
        const container = document.createElement("div");
        container.innerHTML = `
                <div>There is a pit here at "${cell.i},${cell.j}". It has these coins: <span id="value">${objToString(geocache.coins)}</span>.</div>
                <button id="poke">Collect Coin</button><button id="unpoke">Deposit Coin</button>`;
        const poke = container.querySelector<HTMLButtonElement>("#poke")!;

        poke.addEventListener("click", () => {
            if (pitCoinList.length > 0) {
                //const poppedCoin = geocache.coins.pop();
                coinPurse.push(geocache.coins.pop()!);
                knownList.set(cell, geocache.toMomento());
                saveCoinState();
                savePits();
            }
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = objToString(geocache.coins);
            statusPanel.innerHTML = `Coin Inventory: ${objToString(coinPurse)} \n`;
        });
        const unpoke = container.querySelector<HTMLButtonElement>("#unpoke")!;
        unpoke.addEventListener("click", () => {
            if (coinPurse.length > 0) {
                geocache.coins.push(coinPurse.pop()!);
                knownList.set(cell, geocache.toMomento());
                saveCoinState();
                savePits();
            }
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = objToString(geocache.coins);
            statusPanel.innerHTML = `Coin Inventory: ${objToString(coinPurse)} \n`;
        });
        return container;
    });
    tempCaches.push(pit);
    pit.addTo(map);
    savePits();
}

const localCoinPurse = localStorage.getItem("coinPurse");
const localKnownList = localStorage.getItem("knownList");
//let cachedString: string[] = [];
let poopString = new Map<Cell, string>();



function saveCoinState() {
    localStorage.setItem("coinPurse", JSON.stringify(coinPurse));
}

function savePits() {
    localStorage.setItem("knownList", serializeMap(knownList));
}

function loadCoinState() {
    if (localCoinPurse) {
        coinPurse = JSON.parse(localCoinPurse) as Coin[];
    } 
    if (localKnownList) {
        // const boof = localStorage.getItem("knownList");
        // poopString = deserializeMap(boof!);
        // console.log(poopString);
        poopString = deserializeMap(localKnownList);
    }
    console.log(poopString);
    statusPanel.innerHTML = `Coin Inventory: ${objToString(coinPurse)} \n`;
}



function spawnPits() {
    const nearby = gameBoard.getCellsNearPoint(playerMarker.getLatLng());
    nearby.forEach((cell) => {
        if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
            makePit(cell);
        }
    });
}

function addPointtoPolyline(lat: number, lng: number) {
    const newLatLng = leaflet.latLng(lat, lng);
    movementHistory.push(newLatLng);
}

function drawPolylines() {
    polylineHistory = leaflet.polyline(movementHistory, { color: "green" }).addTo(map);
    polylineArray.push(polylineHistory);
}

function clearCaches() {
    for (const geocache of tempCaches) {
        geocache.remove();
    }
}

function serializeMap(map: Map<Cell, string>): string {
    const serializedEntries: [Cell, string][] = [];

    map.forEach((value, key) => {
        serializedEntries.push([key, value]);
    });

    return JSON.stringify(serializedEntries);
}

function deserializeMap(serializedMap: string): Map<Cell, string> {
    return new Map(JSON.parse(serializedMap) as [Cell, string][]);
}
loadCoinState();
spawnPits();
