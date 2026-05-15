export interface CollapseState {
  searchBar: boolean;
  leftPanel: boolean;
  rightPanel: boolean;
  dayStrip: boolean;
}

export interface UIState {
  currentDayId: string | null;
  collapse: CollapseState;
  selectedItemId: string | null;
  detailModalPlaceId: string | null;
}
