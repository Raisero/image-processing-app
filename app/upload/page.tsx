'use client';

import { useState, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

// Funzione per caricare il Web Worker per la compressione Huffman
const loadHuffmanWorker = () => {
    return new Worker('/workers/huffmanWorker.js');
};

// Funzioni di elaborazione immagine
const applyNegative = (ctx: CanvasRenderingContext2D, imageData: ImageData, updateLog: (msg: string) => void) => {
    updateLog('Applicazione del filtro Negativo...');
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i]; // R
        data[i + 1] = 255 - data[i + 1]; // G
        data[i + 2] = 255 - data[i + 2]; // B
    }
    ctx.putImageData(imageData, 0, 0);
    updateLog('Filtro Negativo applicato con successo.');
};

const applyGamma = (
    ctx: CanvasRenderingContext2D,
    imageData: ImageData,
    gamma: number,
    updateLog: (msg: string) => void
) => {
    updateLog('Applicazione della correzione Gamma...');

    const data = imageData.data;
    const correction = gamma;  // Usa gamma direttamente, senza l'inverso

    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, 255 * Math.pow(data[i] / 255, correction)); // R
        data[i + 1] = Math.min(255, 255 * Math.pow(data[i + 1] / 255, correction)); // G
        data[i + 2] = Math.min(255, 255 * Math.pow(data[i + 2] / 255, correction)); // B
        // data[i+3] è il canale alpha, che non va modificato
    }

    ctx.putImageData(imageData, 0, 0);
    updateLog('Correzione Gamma applicata con successo.');
};


const applyHistogramEqualization = (ctx: CanvasRenderingContext2D, imageData: ImageData, updateLog: (msg: string) => void) => {
    updateLog('Equalizzazione dell\'istogramma in corso...');
    const data = imageData.data;
    const hist = new Array(256).fill(0);
    const cdf = new Array(256).fill(0);
    const lut = new Array(256).fill(0);
    const totalPixels = imageData.width * imageData.height;

    // Calcola l'istogramma
    for (let i = 0; i < data.length; i += 4) {
        const intensity = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        hist[intensity]++;
    }

    // Calcola la funzione di distribuzione cumulativa (CDF)
    cdf[0] = hist[0];
    for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + hist[i];
    }

    // Costruisci la LUT (Look-Up Table)
    for (let i = 0; i < 256; i++) {
        lut[i] = Math.round((cdf[i] - cdf[0]) / (totalPixels - cdf[0]) * 255);
    }

    // Applica la LUT ai pixel
    for (let i = 0; i < data.length; i += 4) {
        const intensity = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const newVal = lut[intensity];
        data[i] = data[i + 1] = data[i + 2] = newVal; // Applica la trasformazione per canali RGB
    }

    ctx.putImageData(imageData, 0, 0);
    updateLog('Equalizzazione dell\'istogramma completata.');
};

export default function UploadPage() {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [operation, setOperation] = useState<string>('compression');
    const [originalSize, setOriginalSize] = useState<number | null>(null);
    const [compressedSize, setCompressedSize] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false); // Stato per lo spinner
    const [logMessage, setLogMessage] = useState<string>(''); // Stato per sovrascrivere i log
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Stato per gestire il worker corrente
    const [currentWorker, setCurrentWorker] = useState<Worker | null>(null);

    // Funzione per terminare il worker attuale
    const terminateCurrentWorker = () => {
        if (currentWorker) {
            currentWorker.terminate(); // Termina il worker precedente
            setCurrentWorker(null);
            updateLog('Worker precedente terminato.');
        }
    };

    // Funzione per aggiungere un messaggio ai log (sovrascrive invece di accodare)
    const updateLog = (message: string) => {
        setLogMessage(message); // Sovrascrive il log attuale
    };

    // Gestione caricamento immagine
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setSelectedImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const applyTransformation = () => {
        if (!selectedImage || !canvasRef.current) return;

        // Resetta le informazioni precedenti
        terminateCurrentWorker(); // Assicurati di terminare qualsiasi worker esistente
        setIsLoading(true); // Avvia lo spinner
        setLogMessage(''); // Resetta i log
        setCompressedSize(null); // Resetta le dimensioni compresse

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const image = new window.Image();
        image.src = selectedImage;

        image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            if (ctx) {
                ctx.drawImage(image, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // A seconda dell'operazione selezionata, applica la trasformazione
                switch (operation) {
                    case 'compression': {
                        const worker = loadHuffmanWorker();
                        setCurrentWorker(worker); // Memorizza il nuovo worker
                        updateLog("Invio immagine al worker per la compressione...");
                        worker.postMessage(imageData);

                        // Ascolta i messaggi dal Web Worker
                        worker.onmessage = (e) => {
                            const { progress, detail, compressedBytes, originalBytes } = e.data;

                            // Sovrascrivi log dinamico con il progresso attuale
                            if (progress) {
                                updateLog(`${progress}${detail ? ` - ${detail}` : ''}`);
                            }

                            // Aggiorna la dimensione dell'immagine se disponibile
                            if (compressedBytes && originalBytes) {
                                setCompressedSize(compressedBytes);
                                setOriginalSize(originalBytes);
                                updateLog(`Compressione completata: ${compressedBytes} byte`);
                                setIsLoading(false); // Ferma lo spinner
                            }
                        };

                        // Log degli errori
                        worker.onerror = (error) => {
                            console.error("Errore nel Worker: ", error.message);
                            setIsLoading(false); // Ferma lo spinner in caso di errore
                            updateLog("Errore durante la compressione.");
                        };
                        break;
                    }
                    case 'negative': {
                        updateLog('Applicazione del filtro Negativo...');
                        setTimeout(() => {
                            applyNegative(ctx, imageData, updateLog);
                            setIsLoading(false);
                        }, 1000); // Simula un breve caricamento
                        break;
                    }
                    case 'gamma': {
                        updateLog('Applicazione della correzione Gamma...');
                        setTimeout(() => {
                            applyGamma(ctx, imageData, 2.2, updateLog); // Esempio gamma 2.2
                            setIsLoading(false);
                        }, 1000); // Simula un breve caricamento
                        break;
                    }
                    case 'histogram': {
                        updateLog('Equalizzazione dell\'istogramma in corso...');
                        setTimeout(() => {
                            applyHistogramEqualization(ctx, imageData, updateLog);
                            setIsLoading(false);
                        }, 1000); // Simula un breve caricamento
                        break;
                    }
                    default:
                        updateLog('Operazione non valida.');
                        setIsLoading(false);
                }
            }
        };
    };

    return (
        <div style={{ backgroundColor: '#FFDC60', height: '100vh', padding: '20px' }}>
            <h1 style={{ fontFamily: 'Comic Sans MS', color: '#D7305E', textAlign: 'center' }}>
                Elaborazione Immagine
            </h1>

            <div className="container mt-4">
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }} className="text-dark">
                    {/* Sezione immagine originale */}
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ color: '#D7305E', fontFamily: 'Comic Sans MS' }}>Immagine Originale</h3>
                        <div
                            style={{
                                width: '300px',
                                height: '300px',
                                border: '2px solid #000',
                                backgroundColor: '#EFEFEF',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            {selectedImage ? (
                                <img
                                    src={selectedImage}
                                    alt="Uploaded"
                                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                                />
                            ) : (
                                <p>Nessuna immagine caricata</p>
                            )}
                        </div>
                        <input type="file" accept=".raw,image/*" onChange={handleImageUpload} />
                        {originalSize && <p>Dimensione originale: {(originalSize / 1024).toFixed(2)} KB</p>}
                    </div>

                    {/* Sezione centrale: operazione e pulsante */}
                    <div style={{ textAlign: 'center', margin: '20px' }} className="text-dark">
                        <select
                            value={operation}
                            onChange={(e) => setOperation(e.target.value)}
                            style={{
                                padding: '10px',
                                fontSize: '16px',
                                borderRadius: '5px',
                                borderColor: '#0E92D0',
                            }}
                        >
                            <option value="compression">Operazione: Huffman</option>
                            <option value="negative">Operazione: Negativo</option>
                            <option value="gamma">Operazione: Gamma</option>
                            <option value="histogram">Operazione: Histogram Eq.</option>
                        </select>
                        <br />
                        <button
                            style={{
                                marginTop: '20px',
                                backgroundColor: '#0E92D0',
                                color: '#FFF',
                                borderRadius: '5px',
                                padding: '10px 20px',
                                cursor: 'pointer',
                            }}
                            onClick={applyTransformation}
                        >
                            Applica
                        </button>

                        {/* Spinner di caricamento */}
                        {isLoading && (
                            <div className="mt-3">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        )}

                        {/* Log dinamico sovrascritto */}
                        <div className="mt-3">
                            <p style={{ fontFamily: 'Courier New', fontSize: '14px' }}>{logMessage}</p>
                        </div>
                    </div>

                    {/* Sezione risultato */}
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ color: '#D7305E', fontFamily: 'Comic Sans MS' }}>Risultato</h3>
                        <canvas
                            ref={canvasRef}
                            style={{
                                width: '300px',
                                height: '300px',
                                border: '2px solid #000',
                                backgroundColor: '#EFEFEF',
                            }}
                        />
                        {compressedSize && <p>Dimensione compressa: {(compressedSize / 1024).toFixed(2)} KB</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
