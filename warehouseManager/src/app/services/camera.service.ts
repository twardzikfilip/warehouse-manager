import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Injectable({
    providedIn: 'root',
})
export class CameraService {
    /** Lets the user take a photo or pick one from the gallery; null when cancelled. */
    async getPhoto(labels: { header: string; photo: string; picture: string; cancel: string }): Promise<string | null> {
        try {
            const photo = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Prompt,
                promptLabelHeader: labels.header,
                promptLabelPhoto: labels.photo,
                promptLabelPicture: labels.picture,
                promptLabelCancel: labels.cancel,
            });
            return photo.dataUrl ?? null;
        } catch {
            // Thrown when the user cancels.
            return null;
        }
    }
}
