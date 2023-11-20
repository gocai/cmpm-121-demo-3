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
    /*tempCaches.forEach((pit) => pit.remove());
    tempCaches = [];*/
    for (const geocache of tempCaches) {
        geocache.remove();
    }
    spawnPits();
}


const coinPurse: Coin[] = [];
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";


const knownList = new Map<Cell,string>();
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
    } else{
        knownList.set(cell,geocache.toMomento());
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
            }
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = objToString(geocache.coins);
            statusPanel.innerHTML = `${objToString(coinPurse)} coins collected!`;
        });
        const unpoke = container.querySelector<HTMLButtonElement>("#unpoke")!;
        unpoke.addEventListener("click", () => {
            if (coinPurse.length > 0) {
                geocache.coins.push(coinPurse.pop()!);
                knownList.set(cell, geocache.toMomento());
            }
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = objToString(geocache.coins);
            statusPanel.innerHTML = `${objToString(coinPurse)} coins collected!`;
        });
        return container;
    });
    tempCaches.push(pit);
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

class UniqueCell {
    private static knownCells = new Map<string, UniqueCell>;
    static at(i: number, j: number): UniqueCell {
      const key = [i,j].toString();
      if(!UniqueCell.knownCells.has(key)) {
        UniqueCell.knownCells.set(key, new UniqueCell(i,j));
      }
      return UniqueCell.knownCells.get(key)!;
    }
     constructor(readonly i: number, readonly j: number) {}
  }


spawnPits();
