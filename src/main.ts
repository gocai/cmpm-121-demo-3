import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
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
        const cacheData = JSON.parse(momento) as Coin[];
        this.coins = cacheData;
        console.log(this.coins);
    }
    toMomento() {
        //console.log(JSON.stringify(this.coins));
        return JSON.stringify(this.coins);
    }
    rewriteCoins(array: Coin[]) {
        this.coins = array;
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
            break;
        case "east":
            playerLatLng.lng += TILE_DEGREES;
            playerMarker.setLatLng(playerLatLng);
            break;
        case "north":
            playerLatLng.lat += TILE_DEGREES;
            playerMarker.setLatLng(playerLatLng);
            break;
        case "south":
            playerLatLng.lat -= TILE_DEGREES;
            playerMarker.setLatLng(playerLatLng);
            break;
        case "sensor":
            navigator.geolocation.watchPosition((position) => {
                playerMarker.setLatLng(
                    leaflet.latLng(position.coords.latitude, position.coords.longitude)
                );
                map.setView(playerMarker.getLatLng());
            });
            break;
        case "reset":
            break;
    }
    map.setView(playerMarker.getLatLng());
    tempCaches.forEach((pit) => pit.remove());
    tempCaches = [];
    spawnPits();
}


const coinPurse: Coin[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

const cacheList = new Map<Cell,string>();
let tempCaches: leaflet.Rectangle[] = [];

function objToString(obj: Coin[]): string {
    let coinList = "";
    for (const obje of obj) {
        coinList += `${obje.origin.i},${obje.origin.j},#${obje.serialNumber} \n`;
    }
    return coinList;
}

function makePit(cell: Cell) {
    const pit = leaflet.rectangle(gameBoard.getCellBounds(cell));
    const geocache = new Geocache(cell);
    /*for (let ii = 0; ii < Math.floor(luck([i, j, "initialValue"].toString()) * 10); ii++){
        const nCoin: Coin = { origin: currCell, serialNumber: ii };
        pitCoinList.push(nCoin);
    }*/
    if (cacheList.has(cell)) {
        //console.log(cacheList.get(cell));
        geocache.fromMomento(cacheList.get(cell)!);
    }
    tempCaches.push(pit);
    const pitCoinList = geocache.coins;
    pit.bindPopup(() => {
        const container = document.createElement("div");
        container.innerHTML = `
                <div>There is a pit here at "${cell.i},${cell.j}". It has this many coins: <span id="value">${pitCoinList.length}${objToString(pitCoinList)}</span>.</div>
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
    cacheList.set(cell, geocache.toMomento());
    //console.log(geocache.toMomento());
    pit.addTo(map);
}

function spawnPits() {
    const nearby = gameBoard.getCellsNearPoint(playerMarker.getLatLng());
    nearby.forEach((cell) => {
        if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
            makePit(cell);
        }
    });
}

spawnPits();
