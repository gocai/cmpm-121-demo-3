import leaflet from "leaflet";

export interface Cell {
    readonly i: number;
    readonly j: number;
}

export class Board {

    readonly tileWidth: number;
    readonly tileVisibilityRadius: number;

    private readonly knownCells: Map<string, Cell>;

    constructor(tileWidth: number, tileVisibilityRadius: number) {
        this.tileWidth = tileWidth;
        this.tileVisibilityRadius = tileVisibilityRadius;
        this.knownCells = new Map();
    }

    getCanonicalCell(cell: Cell): Cell {
        const { i, j } = cell;
        const key = [i, j].toString();
        if (!this.knownCells.get(key)) {
            this.knownCells.set(key, cell);
        }
        return this.knownCells.get(key)!;
    }

    getCellForPoint(point: leaflet.LatLng): Cell {
        return this.getCanonicalCell({
            i: Math.floor(point.lat / this.tileWidth),
            j: Math.floor(point.lng / this.tileWidth),
        });
    }

    getCellBounds(cell: Cell): leaflet.LatLngBounds {
        const boundaries = leaflet.latLngBounds([
            [cell.i * this.tileWidth, cell.j * this.tileWidth],
            [(cell.i + 1)*this.tileWidth, (cell.j + 1)* this.tileWidth]
        ]);
        return boundaries;
    }
    getCellsNearPoint(point: leaflet.LatLng): Cell[] {
        const resultCells: Cell[] = [];
        const originCell = this.getCellForPoint(point)!;
        for (let i = -this.tileVisibilityRadius;i < this.tileVisibilityRadius;i++) {
          for (let j = -this.tileVisibilityRadius;j < this.tileVisibilityRadius;j++) {
            resultCells.push(this.getCanonicalCell({ i: originCell.i + i, j: originCell.j + j })); 
          }
        }
        return resultCells;
      }
    }
