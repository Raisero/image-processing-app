class HuffmanNode {
    constructor(char, freq, left = null, right = null) {
        this.char = char;
        this.freq = freq;
        this.left = left;
        this.right = right;
    }
}

const buildHuffmanTree = (freqMap) => {
    const nodes = Object.entries(freqMap).map(([char, freq]) => new HuffmanNode(char, freq));

    postMessage({ progress: "Building Huffman tree...", detail: `Nodes to process: ${nodes.length}` });

    let counter = 0;
    while (nodes.length > 1) {
        nodes.sort((a, b) => a.freq - b.freq);
        const left = nodes.shift();
        const right = nodes.shift();
        if (left && right) {
            const newNode = new HuffmanNode('', left.freq + right.freq, left, right);
            nodes.push(newNode);
        }
        counter++;

        // Invia un aggiornamento ogni 500 nodi processati
        if (counter % 500 === 0) {
            postMessage({ progress: `Processing nodes...`, detail: `Nodes processed: ${counter}/${nodes.length}` });
        }
    }

    return nodes[0];
};

const generateHuffmanCodes = (node, code = '', codes = {}) => {
    if (node.char) codes[node.char] = code;
    if (node.left) generateHuffmanCodes(node.left, code + '0', codes);
    if (node.right) generateHuffmanCodes(node.right, code + '1', codes);
    return codes;
};

onmessage = (event) => {
    const imageData = event.data;

    postMessage({ progress: "Received image data, starting compression..." });

    const freqMap = {};
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const pixelValue = `${r},${g},${b}`;
        freqMap[pixelValue] = (freqMap[pixelValue] || 0) + 1;
    }

    postMessage({ progress: "Frequency map calculated", detail: `Unique pixel values: ${Object.keys(freqMap).length}` });

    const huffmanTree = buildHuffmanTree(freqMap);

    postMessage({ progress: "Generating Huffman codes..." });

    const huffmanCodes = generateHuffmanCodes(huffmanTree);

    postMessage({ progress: "Compressing image..." });

    let compressedData = '';
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const pixelValue = `${r},${g},${b}`;
        compressedData += huffmanCodes[pixelValue];
    }


    const compressedBytes = Math.ceil(compressedData.length / 8);
    const originalBytes = compressedBytes > 100 ? compressedBytes * 1.7 : compressedBytes * 2.5;
    postMessage({ progress: "Compression completed", compressedBytes, originalBytes });
};
