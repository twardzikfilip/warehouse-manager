import { Component, inject } from '@angular/core';
import { ActionSheetController, IonButton, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { languageOutline } from 'ionicons/icons';
import { LANGUAGES, LanguageService } from '../../services/language.service';

/** Header button showing the current UI language; opens a picker to change it. */
@Component({
  selector: 'app-language-switch',
  template: `
    <ion-button (click)="choose()" [attr.aria-label]="'common.language' | translate">
      <ion-icon slot="start" name="language-outline"></ion-icon>
      {{ language.current().toUpperCase() }}
    </ion-button>
  `,
  imports: [IonButton, IonIcon, TranslatePipe],
})
export class LanguageSwitchComponent {
  readonly language = inject(LanguageService);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);

  constructor() {
    addIcons({ languageOutline });
  }

  async choose(): Promise<void> {
    const sheet = await this.actionSheetController.create({
      header: this.translate.instant('common.language'),
      buttons: [
        ...LANGUAGES.map((language) => ({
          text: this.translate.instant(`language.${language}`),
          role: language === this.language.current() ? 'selected' : undefined,
          handler: () => {
            this.language.set(language);
          },
        })),
        { text: this.translate.instant('common.cancel'), role: 'cancel' },
      ],
    });
    await sheet.present();
  }
}
