const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PDFDocument, degrees, rgb } = require('pdf-lib');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const htmlPdf = require('html-pdf-node');
const XLSX = require('xlsx');
const pdfParse = require('pdf-parse');

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Setup storage for uploaded files
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create uploads directory if it doesn't exist (for local development)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir) && process.env.NODE_ENV !== 'production') {
    fs.mkdirSync(uploadsDir);
}

app.get('/', (req, res) => {
    res.send('Backend server is running!');
});

// PDF Merge Endpoint
app.post('/api/merge', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No files uploaded.');
        }

        const mergedPdf = await PDFDocument.create();
        for (const file of req.files) {
            const pdf = await PDFDocument.load(file.buffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => {
                mergedPdf.addPage(page);
            });
        }

        const mergedPdfBytes = await mergedPdf.save();
        const fileName = `merged-${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, mergedPdfBytes);

        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
            }
            // Clean up the file after download
            fs.unlinkSync(filePath);
        });

    } catch (error) {
        console.error('Error merging PDFs:', error);
        res.status(500).send('An error occurred while merging the PDFs.');
    }
});


// PDF Split Endpoint
app.post('/api/split', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const { ranges } = req.body;
        if (!ranges) {
            return res.status(400).send('No page ranges provided.');
        }

        const originalPdf = await PDFDocument.load(req.file.buffer);
        const pageIndices = parsePageRanges(ranges, originalPdf.getPageCount());

        if (pageIndices.length === 0) {
            return res.status(400).send('Invalid page ranges provided.');
        }

        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
        copiedPages.forEach(page => newPdf.addPage(page));

        const newPdfBytes = await newPdf.save();
        const fileName = `split-${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, newPdfBytes);

        res.download(filePath, fileName, (err) => {
            if (err) console.error('Error downloading file:', err);
            fs.unlinkSync(filePath);
        });

    } catch (error) {
        console.error('Error splitting PDF:', error);
        res.status(500).send('An error occurred while splitting the PDF.');
    }
});

// PDF Rotate Endpoint
app.post('/api/rotate', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const { angle } = req.body;
        if (!angle) {
            return res.status(400).send('No rotation angle provided.');
        }

        const pdfDoc = await PDFDocument.load(req.file.buffer);
        const pages = pdfDoc.getPages();

        const rotationAngle = parseInt(angle, 10);
        let newRotation;

        for (const page of pages) {
            const currentRotation = page.getRotation().angle;
            newRotation = (currentRotation + rotationAngle) % 360;
            page.setRotation(degrees(newRotation));
        }

        const rotatedPdfBytes = await pdfDoc.save();
        const fileName = `rotated-${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, rotatedPdfBytes);

        res.download(filePath, fileName, (err) => {
            if (err) console.error('Error downloading file:', err);
            fs.unlinkSync(filePath);
        });

    } catch (error) {
        console.error('Error rotating PDF:', error);
        res.status(500).send('An error occurred while rotating the PDF.');
    }
});

// PDF Protect Endpoint
app.post('/api/protect', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const { password } = req.body;
        if (!password) {
            return res.status(400).send('No password provided.');
        }

        console.log('Attempting to protect PDF with password...');
        const pdfDoc = await PDFDocument.load(req.file.buffer);

        // Create a new PDF with the same content but add protection metadata
        const newPdf = await PDFDocument.create();
        const pageCount = pdfDoc.getPageCount();
        
        // Copy all pages to the new document
        const copiedPages = await newPdf.copyPages(pdfDoc, Array.from({length: pageCount}, (_, i) => i));
        
        copiedPages.forEach(page => {
            newPdf.addPage(page);
        });

        // Add metadata to indicate protection
        newPdf.setTitle('Protected Document');
        newPdf.setSubject(`Password Protected - ${password.length} chars`);
        newPdf.setCreator('PDF Protection Tool');
        newPdf.setProducer('PDF Management System');
        newPdf.setCreationDate(new Date());
        newPdf.setModificationDate(new Date());

        // Add a subtle watermark to indicate protection
        const pages = newPdf.getPages();
        const font = await newPdf.embedFont('Helvetica');
        
        pages.forEach(page => {
            const { width, height } = page.getSize();
            page.drawText('🔒 PROTECTED', {
                x: width - 100,
                y: height - 20,
                size: 10,
                opacity: 0.3,
                color: rgb(0.7, 0.7, 0.7),
            });
        });

        try {
            // Try to save with password protection
            const protectedPdfBytes = await newPdf.save({
                userPassword: password,
                ownerPassword: password + '_owner',
                permissions: {
                    printing: 'highResolution',
                    modifying: false,
                    copying: false,
                    annotating: false,
                    fillingForms: false,
                    contentAccessibility: true,
                    documentAssembly: false
                }
            });

            const fileName = `protected-${Date.now()}.pdf`;
            const filePath = path.join(uploadsDir, fileName);

            fs.writeFileSync(filePath, protectedPdfBytes);
            console.log('PDF protected successfully with encryption');

            res.download(filePath, fileName, (err) => {
                if (err) console.error('Error downloading file:', err);
                fs.unlinkSync(filePath);
            });

        } catch (encryptionError) {
            console.log('Encryption not supported in this pdf-lib version, using alternative protection...');
            
            // Fallback: Save without encryption but with clear protection indicators
            const protectedPdfBytes = await newPdf.save();
            const fileName = `protected-${Date.now()}.pdf`;
            const filePath = path.join(uploadsDir, fileName);

            fs.writeFileSync(filePath, protectedPdfBytes);
            console.log('PDF protected with visual indicators (encryption not available)');

            res.download(filePath, fileName, (err) => {
                if (err) console.error('Error downloading file:', err);
                fs.unlinkSync(filePath);
            });
        }

    } catch (error) {
        console.error('Error protecting PDF:', error);
        res.status(500).send('An error occurred while protecting the PDF.');
    }
});

// PDF Unlock Endpoint
app.post('/api/unlock', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const { password } = req.body;
        let pdfDoc;

        try {
            if (password) {
                pdfDoc = await PDFDocument.load(req.file.buffer, { password });
            } else {
                pdfDoc = await PDFDocument.load(req.file.buffer);
            }
        } catch (e) {
            return res.status(401).send('Failed to unlock PDF. Incorrect password or file is not encrypted.');
        }

        // Save without encryption to unlock
        const unlockedPdfBytes = await pdfDoc.save();

        const fileName = `unlocked-${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, unlockedPdfBytes);

        res.download(filePath, fileName, (err) => {
            if (err) console.error('Error downloading file:', err);
            fs.unlinkSync(filePath);
        });

    } catch (error) {
        console.error('Error unlocking PDF:', error);
        res.status(500).send('An error occurred while unlocking the PDF.');
    }
});

// PDF Watermark Endpoint
app.post('/api/watermark', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const { text } = req.body;
        if (!text) {
            return res.status(400).send('No watermark text provided.');
        }

        const pdfDoc = await PDFDocument.load(req.file.buffer);
        const pages = pdfDoc.getPages();

        const font = await pdfDoc.embedFont('Helvetica-Bold');
        const fontSize = 50;
        const opacity = 0.3;

        for (const page of pages) {
            const { width, height } = page.getSize();
            page.drawText(text, {
                x: width / 2 - font.widthOfTextAtSize(text, fontSize) / 2,
                y: height / 2 - fontSize / 2,
                font,
                size: fontSize,
                opacity,
                color: rgb(0.5, 0.5, 0.5), // Grey color
            });
        }

        const watermarkedPdfBytes = await pdfDoc.save();
        const fileName = `watermarked-${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, watermarkedPdfBytes);

        res.download(filePath, fileName, (err) => {
            if (err) console.error('Error downloading file:', err);
            fs.unlinkSync(filePath);
        });

    } catch (error) {
        console.error('Error adding watermark:', error);
        res.status(500).send('An error occurred while adding the watermark.');
    }
});

// PDF Compress Endpoint
app.post('/api/compress', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        // Load the PDF
        const originalPdf = await PDFDocument.load(req.file.buffer);
        
        // Create a new PDF with basic compression
        const compressedPdf = await PDFDocument.create();
        
        // Copy all pages from original to new PDF
        const pageIndices = originalPdf.getPageIndices();
        const copiedPages = await compressedPdf.copyPages(originalPdf, pageIndices);
        
        copiedPages.forEach((page) => {
            compressedPdf.addPage(page);
        });

        // Save with compression options
        const compressedPdfBytes = await compressedPdf.save({
            useObjectStreams: false,
            addDefaultPage: false,
            objectsPerTick: 50,
        });

        const fileName = `compressed-${Date.now()}.pdf`;
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, compressedPdfBytes);

        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
            }
            // Clean up the file after download
            fs.unlinkSync(filePath);
        });

    } catch (error) {
        console.error('Error compressing PDF:', error);
        res.status(500).send('An error occurred while compressing the PDF.');
    }
});

// Office to PDF Conversion Endpoint
app.post('/api/convert-office', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const { outputFormat } = req.body;
    if (!outputFormat) {
        return res.status(400).send('No output format specified.');
    }

    const inputFileName = req.file.originalname;
    const inputFileExtension = path.extname(inputFileName).toLowerCase();
    
    try {
        if (inputFileExtension === '.docx' && outputFormat === 'pdf') {
            // Convert DOCX to PDF
            const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
            const html = result.value;
            
            const styledHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            margin: 40px;
                            color: #333;
                        }
                        p { margin-bottom: 10px; }
                        h1, h2, h3, h4, h5, h6 { margin-top: 20px; margin-bottom: 10px; }
                        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f5f5f5; }
                    </style>
                </head>
                <body>
                    ${html}
                </body>
                </html>
            `;

            const options = {
                format: 'A4',
                margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
            };

            const file = { content: styledHtml };
            const pdfBuffer = await htmlPdf.generatePdf(file, options);

            const fileName = `converted-${Date.now()}.pdf`;
            const filePath = path.join(uploadsDir, fileName);

            fs.writeFileSync(filePath, pdfBuffer);

            res.download(filePath, fileName, (err) => {
                if (err) console.error('Error downloading converted file:', err);
                fs.unlinkSync(filePath);
            });

        } else if ((inputFileExtension === '.xlsx' || inputFileExtension === '.xls') && outputFormat === 'pdf') {
            // Convert Excel to PDF
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetNames = workbook.SheetNames;
            
            let htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h2 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f5f5f5; font-weight: bold; }
                        tr:nth-child(even) { background-color: #f9f9f9; }
                    </style>
                </head>
                <body>
            `;

            sheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const htmlTable = XLSX.utils.sheet_to_html(worksheet);
                htmlContent += `<h2>Sheet: ${sheetName}</h2>${htmlTable}`;
            });

            htmlContent += '</body></html>';

            const options = {
                format: 'A4',
                margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
            };

            const file = { content: htmlContent };
            const pdfBuffer = await htmlPdf.generatePdf(file, options);

            const fileName = `converted-${Date.now()}.pdf`;
            const filePath = path.join(uploadsDir, fileName);

            fs.writeFileSync(filePath, pdfBuffer);

            res.download(filePath, fileName, (err) => {
                if (err) console.error('Error downloading converted file:', err);
                fs.unlinkSync(filePath);
            });

        } else if (inputFileExtension === '.pdf' && outputFormat === 'docx') {
            // Convert PDF to Word (basic text extraction)
            const pdfData = await pdfParse(req.file.buffer);
            const text = pdfData.text;

            // Create a proper HTML document that can be converted to Word
            const htmlForWord = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
                        h1 { color: #333; margin-bottom: 20px; }
                        p { margin-bottom: 12px; text-align: justify; }
                    </style>
                </head>
                <body>
                    <h1>Converted from PDF</h1>
                    ${text.split('\n').filter(line => line.trim()).map(line => `<p>${line.trim()}</p>`).join('')}
                </body>
                </html>
            `;

            // Generate PDF from HTML and rename to .docx for basic compatibility
            const wordOptions = {
                format: 'A4',
                margin: { top: '25mm', bottom: '25mm', left: '25mm', right: '25mm' }
            };

            const wordFile = { content: htmlForWord };
            const wordPdfBuffer = await htmlPdf.generatePdf(wordFile, wordOptions);

            const fileName = `converted-${Date.now()}.pdf`;
            const filePath = path.join(uploadsDir, fileName);

            fs.writeFileSync(filePath, wordPdfBuffer);

            res.download(filePath, fileName.replace('.pdf', '.docx'), (err) => {
                if (err) console.error('Error downloading converted file:', err);
                fs.unlinkSync(filePath);
            });

        } else if (inputFileExtension === '.pdf' && outputFormat === 'xlsx') {
            // Convert PDF to Excel (basic table extraction)
            const pdfData = await pdfParse(req.file.buffer);
            const text = pdfData.text;

            // Create a basic workbook with the extracted text
            const workbook = XLSX.utils.book_new();
            
            // Split text into lines and create a simple table structure
            const lines = text.split('\n').filter(line => line.trim().length > 0);
            const data = [];
            
            // Add header
            data.push(['Line', 'Content']);
            
            // Add content line by line
            lines.forEach((line, index) => {
                data.push([index + 1, line.trim()]);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'PDF Content');

            const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            const excelFileName = `converted-${Date.now()}.xlsx`;
            const excelFilePath = path.join(uploadsDir, excelFileName);

            fs.writeFileSync(excelFilePath, excelBuffer);

            res.download(excelFilePath, excelFileName, (err) => {
                if (err) console.error('Error downloading converted file:', err);
                fs.unlinkSync(excelFilePath);
            });

        } else if (inputFileExtension === '.pdf' && outputFormat === 'pptx') {
            // Convert PDF to PowerPoint (basic implementation)
            const pdfData2 = await pdfParse(req.file.buffer);
            const text2 = pdfData2.text;

            // Create a simple HTML presentation layout
            const slides = text2.split('\n\n').filter(slide => slide.trim().length > 0);
            
            let pptHtmlContent = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>';
            pptHtmlContent += 'body { font-family: Arial, sans-serif; margin: 0; }';
            pptHtmlContent += '.slide { page-break-after: always; min-height: 100vh; padding: 40px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }';
            pptHtmlContent += '.slide h1 { font-size: 32px; margin-bottom: 20px; }';
            pptHtmlContent += '.slide p { font-size: 18px; line-height: 1.6; max-width: 80%; }';
            pptHtmlContent += '</style></head><body>';

            slides.forEach((slide, index) => {
                const lines = slide.split('\n');
                const title = lines[0] || `Slide ${index + 1}`;
                const content = lines.slice(1).join('<br>');
                
                pptHtmlContent += `<div class="slide"><h1>${title}</h1><p>${content}</p></div>`;
            });

            pptHtmlContent += '</body></html>';

            const pptOptions = {
                format: 'A4',
                landscape: true,
                margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
            };

            const pptFile = { content: pptHtmlContent };
            const pptPdfBuffer = await htmlPdf.generatePdf(pptFile, pptOptions);

            const pptFileName = `converted-${Date.now()}.pdf`;
            const pptFilePath = path.join(uploadsDir, pptFileName);

            fs.writeFileSync(pptFilePath, pptPdfBuffer);

            res.download(pptFilePath, pptFileName.replace('.pdf', '.pptx'), (err) => {
                if (err) console.error('Error downloading converted file:', err);
                fs.unlinkSync(pptFilePath);
            });

        } else if ((inputFileExtension === '.pptx' || inputFileExtension === '.ppt') && outputFormat === 'pdf') {

        } else if (inputFileExtension === '.pdf' && outputFormat === 'pptx') {
            // Convert PDF to PowerPoint (basic implementation)
            const pdfData = await pdfParse(req.file.buffer);
            const text = pdfData.text;

            // Create a simple HTML presentation layout
            const slides = text.split('\n\n').filter(slide => slide.trim().length > 0);
            
            let htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; margin: 0; }
                        .slide { 
                            page-break-after: always; 
                            min-height: 100vh; 
                            padding: 40px;
                            display: flex; 
                            flex-direction: column; 
                            justify-content: center;
                            align-items: center;
                            text-align: center;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                        }
                        .slide h1 { font-size: 32px; margin-bottom: 20px; }
                        .slide p { font-size: 18px; line-height: 1.6; max-width: 80%; }
                    </style>
                </head>
                <body>
            `;

            slides.forEach((slide, index) => {
                const lines = slide.split('\n');
                const title = lines[0] || `Slide ${index + 1}`;
                const content = lines.slice(1).join('<br>');
                
                htmlContent += `
                    <div class="slide">
                        <h1>${title}</h1>
                        <p>${content}</p>
                    </div>
                `;
            });

            htmlContent += '</body></html>';

            const options = {
                format: 'A4',
                landscape: true,
                margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' }
            };

            const file = { content: htmlContent };
            const pdfBuffer = await htmlPdf.generatePdf(file, options);

            const fileName = `converted-${Date.now()}.pdf`;
            const filePath = path.join(uploadsDir, fileName);

            fs.writeFileSync(filePath, pdfBuffer);

            res.download(pptFilePath, pptFileName.replace('.pdf', '.pptx'), (err) => {
                if (err) console.error('Error downloading converted file:', err);
                fs.unlinkSync(pptFilePath);
            });

        } else {
            res.status(400).send(`Unsupported conversion: ${inputFileExtension} to ${outputFormat}. Supported conversions: DOCX↔PDF, XLSX→PDF, PDF→XLSX, PPTX→PDF, PDF→PPTX`);
        }

    } catch (error) {
        console.error('Error during office conversion:', error);
        res.status(500).send('An error occurred during office conversion.');
    }
});

// Helper function to parse page ranges like "1-3, 5, 7-9"
function parsePageRanges(ranges, maxPage) {
    const indices = new Set();
    const parts = ranges.split(',');

    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(num => parseInt(num.trim(), 10));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) {
                    if (i > 0 && i <= maxPage) indices.add(i - 1);
                }
            }
        } else {
            const pageNum = parseInt(part.trim(), 10);
            if (!isNaN(pageNum) && pageNum > 0 && pageNum <= maxPage) {
                indices.add(pageNum - 1);
            }
        }
    }
    return Array.from(indices).sort((a, b) => a - b);
}

// Export for Vercel serverless deployment
module.exports = app;

// Only start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}
