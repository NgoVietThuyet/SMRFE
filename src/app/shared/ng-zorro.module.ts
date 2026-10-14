import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzAvatarModule } from "ng-zorro-antd/avatar";
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzBreadCrumbModule } from "ng-zorro-antd/breadcrumb";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCardModule } from "ng-zorro-antd/card";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzDescriptionsModule } from "ng-zorro-antd/descriptions";
import { NzDividerModule } from "ng-zorro-antd/divider";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzFormModule } from "ng-zorro-antd/form";
import { NzGridModule } from "ng-zorro-antd/grid";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzInputNumberModule } from "ng-zorro-antd/input-number";
import { NzLayoutModule } from "ng-zorro-antd/layout";
import { NzListModule } from "ng-zorro-antd/list";
import { NzMenuModule } from "ng-zorro-antd/menu";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzPageHeaderModule } from "ng-zorro-antd/page-header";
import { NzPaginationModule } from "ng-zorro-antd/pagination";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzPopoverModule } from "ng-zorro-antd/popover";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzResultModule } from "ng-zorro-antd/result";
import { NzSegmentedModule } from "ng-zorro-antd/segmented";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzSkeletonModule } from "ng-zorro-antd/skeleton";
import { NzSpaceModule } from "ng-zorro-antd/space";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { NzSplitterModule } from "ng-zorro-antd/splitter";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { NzTableModule } from "ng-zorro-antd/table";
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzTimePickerModule } from "ng-zorro-antd/time-picker";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzTreeModule } from "ng-zorro-antd/tree";
import { NzTreeSelectModule } from "ng-zorro-antd/tree-select";
import { NzUploadModule } from "ng-zorro-antd/upload";
import { InputClearComponent } from "./components/input-clear/input-clear.component";
import { PermissionDirective } from "./directives";

/**
 * Bộ import dùng chung cho component standalone (giữ cách dùng `imports: [SharedModules]` của 2.FrontEnd).
 * Không đưa HttpClientModule vào đây: HttpClient đã cấu hình ở app.config (provideHttpClient + interceptors).
 */
export const SharedModules = [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    ScrollingModule,
    InputClearComponent,
    PermissionDirective,

    NzAlertModule,
    NzAvatarModule,
    NzBadgeModule,
    NzBreadCrumbModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzCollapseModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzDividerModule,
    NzDrawerModule,
    NzDropDownModule,
    NzEmptyModule,
    NzFormModule,
    NzGridModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzLayoutModule,
    NzListModule,
    NzMenuModule,
    NzModalModule,
    NzPageHeaderModule,
    NzPaginationModule,
    NzPopconfirmModule,
    NzPopoverModule,
    NzRadioModule,
    NzResultModule,
    NzSegmentedModule,
    NzSelectModule,
    NzSkeletonModule,
    NzSpaceModule,
    NzSpinModule,
    NzSplitterModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTimePickerModule,
    NzToolTipModule,
    NzTreeModule,
    NzTreeSelectModule,
    NzUploadModule,
];
