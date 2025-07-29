export class ImageUploader {
    constructor(options) {
        this.uploadArea = options.uploadArea;
        this.fileInput = options.fileInput;
        this.previewImage = options.previewImage;
        this.uploadedImageDiv = options.uploadedImageDiv;
        this.removeButton = options.removeButton;
        this.onImageLoaded = options.onImageLoaded;
        
        this.currentImageData = null;
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        // クリックでファイル選択
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        // ファイル選択時の処理
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFile(file);
            }
        });
        
        // ドラッグ＆ドロップの設定
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });
        
        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });
        
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                this.handleFile(file);
            }
        });
        
        // 画像削除ボタン
        this.removeButton.addEventListener('click', () => {
            this.removeImage();
        });
    }
    
    async handleFile(file) {
        if (file.type === 'application/pdf') {
            // PDFの処理
            await this.handlePdfFile(file);
        } else if (file.type.startsWith('image/')) {
            // 画像ファイルの処理
            this.handleImageFile(file);
        } else {
            alert('対応していないファイル形式です。PDF、PNG、JPGファイルを選択してください。');
        }
    }
    
    async handlePdfFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1); // 最初のページを取得
            
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // CanvasをBlobに変換
            canvas.toBlob((blob) => {
                const imageUrl = URL.createObjectURL(blob);
                this.displayImage(imageUrl, canvas.width, canvas.height);
            });
            
        } catch (error) {
            console.error('PDF読み込みエラー:', error);
            alert('PDFファイルの読み込みに失敗しました。');
        }
    }
    
    handleImageFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.displayImage(e.target.result, img.width, img.height);
            };
            img.src = e.target.result;
        };
        
        reader.readAsDataURL(file);
    }
    
    handlePastedImage(blob) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.displayImage(e.target.result, img.width, img.height);
            };
            img.src = e.target.result;
        };
        
        reader.readAsDataURL(blob);
    }
    
    displayImage(imageUrl, width, height) {
        this.currentImageData = {
            url: imageUrl,
            width: width,
            height: height
        };
        
        this.previewImage.src = imageUrl;
        this.uploadArea.style.display = 'none';
        this.uploadedImageDiv.style.display = 'block';
        
        if (this.onImageLoaded) {
            this.onImageLoaded(this.currentImageData);
        }
    }
    
    removeImage() {
        this.currentImageData = null;
        this.previewImage.src = '';
        this.uploadArea.style.display = 'block';
        this.uploadedImageDiv.style.display = 'none';
        this.fileInput.value = '';
        
        // オーバーレイセクションとピンセクションを非表示に
        document.getElementById('overlaySection').style.display = 'none';
        document.getElementById('pinSection').style.display = 'none';
    }
}