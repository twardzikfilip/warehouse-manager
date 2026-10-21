import { Component, inject } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonButton } from '@ionic/angular/standalone';
import { ExploreContainerComponent } from '../../explore-container/explore-container.component';
import { ProductStore } from 'src/app/store/products.store';

@Component({
  selector: 'app-list',
  templateUrl: 'list.page.html',
  styleUrls: ['list.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, ExploreContainerComponent, IonGrid, IonRow, IonCol, IonButton],
})
export class ListPage {

  readonly productsStore = inject(ProductStore);

  // list of profucts in ion grid
  constructor() {
     //productFacade.loadProducts();
     console.log('test')
  }

}
