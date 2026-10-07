// Requerimiento: Fotos comprimidas <= 200 KB
export const comprimirFotoCamara = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const scale = MAX_WIDTH / img.width;

        canvas.width = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width;
        canvas.height = (img.width > MAX_WIDTH) ? img.height * scale : img.height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        let quality = 0.7;
        let base64 = canvas.toDataURL('image/jpeg', quality);

        // Ajustar iterativamente si pesa más de 200 KB
        while (base64.length * (3 / 4) > 200 * 1024 && quality > 0.1) {
          quality -= 0.1;
          base64 = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(base64);
      };
    };
    reader.onerror = (err) => reject(err);
  });
};