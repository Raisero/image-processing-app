'use client';

import { useState, useEffect, useRef } from 'react';
import React from 'react';

// Nodo per l'albero Huffman
class HuffmanNode {
    constructor(
        public char: string,
        public freq: number,
        public left: HuffmanNode | null = null,
        public right: HuffmanNode | null = null
    ) { }
}

// Funzione per costruire l'albero di Huffman
const buildHuffmanTree = (freqMap: Record<string, number>) => {
    const nodes = Object.entries(freqMap).
        map(([char, freq]) => new HuffmanNode(char, freq));

    while (nodes.length > 1) {
        nodes.sort((a, b) => a.freq - b.freq);
        const left = nodes.shift();
        const right = nodes.shift();
        if (left && right) {
            const newNode =
                new HuffmanNode('', left.freq + right.freq, left, right);
            nodes.push(newNode);
        }
    }
    return nodes[0];
};

// Funzione per generare i codici di Huffman dall'albero
const generateHuffmanCodes = (
    node: HuffmanNode,
    code: string = '',
    codes: Record<string, string> = {}
) => {
    if (node.char) codes[node.char] = code;
    if (node.left) generateHuffmanCodes(node.left, code + '0', codes);
    if (node.right) generateHuffmanCodes(node.right, code + '1', codes);
    return codes;
};
const compressImageWithHuffman = (imageData: ImageData) => {
    const freqMap: Record<string, number> = {};

    // Calcola la frequenza di ogni valore di intensità dei pixel
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const pixelValue = `${r},${g},${b}`;
        freqMap[pixelValue] = (freqMap[pixelValue] || 0) + 1;
    }

    // Crea l'albero di Huffman e genera i codici
    const huffmanTree = buildHuffmanTree(freqMap);
    const huffmanCodes = generateHuffmanCodes(huffmanTree);

    // Comprimi l'immagine usando i codici di Huffman
    let compressedData = '';
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const pixelValue = `${r},${g},${b}`;
        compressedData += huffmanCodes[pixelValue];
    }

    // Calcolo del numero di byte nel dato compresso
    const originalBytes = imageData.data.length; // Dimensione originale in byte
    const compressedBytes = Math.ceil(compressedData.length / 8); // Dimensione compressa in byte

    console.log(`Original Bytes: ${originalBytes}, Compressed Bytes: ${compressedBytes}`);

    return { compressedBytes, originalBytes };
};


export default function UploadPage() {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [operation, setOperation] = useState<string>('negative');
    const [originalSize, setOriginalSize] = useState<number | null>(null);
    const [compressedSize, setCompressedSize] = useState<number | null>(null);
    const [operationChoosed, setOperationChoosed] = useState(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Gestione caricamento immagine
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setOriginalSize(file.size); // Memorizza la dimensione originale
            const reader = new FileReader();
            reader.onload = (e) => {
                setSelectedImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const applyTransformation = () => {
        setCompressedSize(null);
        setOriginalSize(null);
        if (!selectedImage || !canvasRef.current) return;

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
                setOperationChoosed(operation);
                switch (operation) {
                    case 'negative':
                        applyNegative(ctx, imageData);
                        break;
                    case 'compression':
                        const { compressedBytes, originalBytes } = compressImageWithHuffman(imageData);
                        setCompressedSize(compressedBytes); // Memorizza la dimensione compressa
                        setOriginalSize(originalBytes); // Memorizza la dimensione originale
                        break;
                    case 'gamma':
                        applyGamma(ctx, imageData, 2.2); // Esempio di gamma
                        break;
                    case 'histogramEqualization':
                        applyHistogramEqualization(ctx, imageData);
                        break;
                    default:
                        break;
                }
            }
        };
    };

    // Funzione per invertire i colori
    const applyNegative = (ctx: CanvasRenderingContext2D, imageData: ImageData) => {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i]; // R
            data[i + 1] = 255 - data[i + 1]; // G
            data[i + 2] = 255 - data[i + 2]; // B
        }
        ctx.putImageData(imageData, 0, 0);
    };
    const applyGamma = (ctx: CanvasRenderingContext2D, imageData: ImageData, gamma: number) => {
        const data = imageData.data;
        const correction = 1 / gamma;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 * Math.pow(data[i] / 255, correction); // R
            data[i + 1] = 255 * Math.pow(data[i + 1] / 255, correction); // G
            data[i + 2] = 255 * Math.pow(data[i + 2] / 255, correction); // B
        }
        ctx.putImageData(imageData, 0, 0);
    };

    // Funzione per l'equalizzazione dell'istogramma
    const applyHistogramEqualization = (ctx: CanvasRenderingContext2D, imageData: ImageData) => {

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
                        <input type="file" accept="image/*" onChange={handleImageUpload} />
                        {operation == "compression" && originalSize && compressedSize && <p>Dimensione originale: {(originalSize / 1024).toFixed(2)} KB</p>}
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
                            <option value="negative">Operazione: Negativo</option>
                            <option value="compression">Operazione: Huffman</option>
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
                        {operation == "compression" && compressedSize && <p>Dimensione compressa: {(compressedSize / 1024).toFixed(2)} KB</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
