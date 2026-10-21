import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Injectable({
    providedIn: 'root',
})
export class CameraService {
    constructor() {}

    async takePhoto(): Promise<string | null> {
        try {
            const photo = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Base64, // opotional: CameraResultType.DataUrl
                source: CameraSource.Camera,
            });
            console.log('Photo taken:', photo);
            return `data:image/jpeg;base64,${photo.base64String}` // || null;
        } catch (error) {
            console.error('Error taking photo:', error);
            return null;
        }
    }
}