import { Component, OnInit, ChangeDetectionStrategy, Optional } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs/Observable';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs/operators';

import { InMemoryDataService } from '../../core';
import { Villain } from '../../core';
import { VillainDispatchers, VillainSelectors } from '../../store/services';

@Component({
  selector: 'app-villain-list',
  template: `
    <div>
      <div class="button-group">
        <button (click)="toggleDataSource()" *ngIf="nextDataSource">{{nextDataSource}}</button>
        <button (click)="getVillains()">Refresh</button>
        <button (click)="enableAddMode()" *ngIf="!addingVillain && !selectedVillain">Add</button>
      </div>
      <div>
        <p>Filter the villains</p>
        <input [value]="filterText$ | async" (input)="setFilter($event.target.value)"/>
      </div>
      <div *ngIf="filteredVillains$ | async as villains">

        <div *ngIf="loading$ | async;else villainList">Loading</div>

        <ng-template #villainList>
          <ul class="villains">
            <li *ngFor="let villain of villains"
              class="villain-container"
              [class.selected]="villain === selectedVillain">
              <div class="villain-element">
                <div class="badge">{{villain.id}}</div>
                <div class="villain-text" (click)="onSelect(villain)">
                  <div class="name">{{villain.name}}</div>
                  <div class="saying">{{villain.saying}}</div>
                </div>
              </div>
              <button class="delete-button" (click)="deleteVillain(villain)">Delete</button>
            </li>
          </ul>
        </ng-template>
      </div>

      <ng-template #elseTemplate>Loading ...</ng-template>
      <app-villain-detail
        *ngIf="selectedVillain || addingVillain"
        [villain]="selectedVillain"
        (unselect)="unselect()"
        (villainChanged)="save($event)">
      </app-villain-detail>
    </div>
  `,
  styleUrls: ['./villain-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VillainListComponent implements OnInit {
  addingVillain = false;
  nextDataSource: string;
  selectedVillain: Villain = null;

  filteredVillains$: Observable<Villain[]>;
  loading$: Observable<boolean>;
  filter$: Observable<string>;
  searchText = '';
  filterText$: Observable<string>;

  constructor(
    private villainDispatchers: VillainDispatchers,
    private villainSelectors: VillainSelectors,
    @Optional() private inMemService: InMemoryDataService
  ) {
    if (inMemService) {
      this.nextDataSource = 'Go Remote';
    }
  }

  ngOnInit() {
    this.filteredVillains$ = this.villainSelectors.filteredVillains$();
    this.loading$ = this.villainSelectors.loading$();
    this.filter$ = this.villainSelectors.filter$();

    this.filter$
      .pipe(debounceTime(500), distinctUntilChanged(), skip(1))
      .subscribe((val: string) => this.filterVillains());
  }

  setFilter(value: string) {
    this.villainDispatchers.setFilter(value);
  }

  clear() {
    this.addingVillain = false;
    this.selectedVillain = null;
  }

  deleteVillain(villain: Villain) {
    this.unselect();
    this.villainDispatchers.delete(villain);
  }

  enableAddMode() {
    this.addingVillain = true;
    this.selectedVillain = null;
  }

  filterVillains() {
    this.villainDispatchers.getFiltered();
  }

  getVillains() {
    this.villainDispatchers.getAll();
  }

  onSelect(villain: Villain) {
    this.addingVillain = false;
    this.selectedVillain = villain;
  }

  save(arg: { mode: 'add' | 'update'; villain: Villain }) {
    this.villainDispatchers.save(arg.villain, arg.mode);
  }

  toggleDataSource() {
    const localSource = this.nextDataSource === 'Go Local';
    this.inMemService.active = localSource;
    this.nextDataSource = localSource ? 'Go Remote' : 'Go Local';
    this.getVillains();
  }

  unselect() {
    this.addingVillain = false;
    this.selectedVillain = null;
  }
}