// global.d.ts
export { };

declare global {
    interface Window {
        ml5: any;  // Dichiarazione della proprietà ml5 sull'oggetto window
    }
}
