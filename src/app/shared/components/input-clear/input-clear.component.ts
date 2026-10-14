import {Component, Input, forwardRef, Output, EventEmitter, ViewChild, ElementRef} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR, FormControl} from '@angular/forms';
import {ReactiveFormsModule} from '@angular/forms';
import {NzInputModule} from 'ng-zorro-antd/input';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {NzIconModule} from 'ng-zorro-antd/icon';
import {NzFormModule} from 'ng-zorro-antd/form';
import { AutofocusDirective } from '../../directives/auto-focus.directive';

type CustomNzStatus = 'error' | 'warning' | '';

@Component({
  selector: 'app-input-clear',
  templateUrl: './input-clear.component.html',
  styleUrls: ['./input-clear.component.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NzInputModule,
    CommonModule,
    FormsModule,
    AutofocusDirective,
    NzIconModule,
    NzFormModule,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputClearComponent),
      multi: true,
    },
  ],
})
export class InputClearComponent implements ControlValueAccessor {
  @ViewChild('inputControl') inputControl!: ElementRef;
  @ViewChild('inputNoControl') inputNoControl!: ElementRef;

  @Input() focus: boolean = false;
  @Output() enterEvent = new EventEmitter<string>();
  @Output() input = new EventEmitter<string>();
  @Output() click = new EventEmitter<string>();
  @Output() blur = new EventEmitter<string>();
  @Output() valueChange = new EventEmitter<string>();
  @Input() initFocus: boolean = false;
  @Input() nzAutosize: any = {minRows: 3, maxRows: 5};
  @Input() type: string = 'text';
  @Input() nzErrorTip: string = '';
  @Input() status: CustomNzStatus = '';
  @Input() control!: FormControl;
  @Input() value!: string;
  @Input() class: string = '';
  @Input() formItemClass: string = '';
  @Input() classWraper: string = '';
  @Input() label: string = '';
  @Input() required: boolean = false;
  @Input() onlyNumber: boolean = false;
  @Input() disabled: boolean = false;
  @Input() textArea: boolean = false;
  @Input() placeholder: string = '' ;
  @Input() showErrors: any = null;
  @Input() errorsRequired: any = null;
  @Input() errorsWrongFormat: any = null;
  Object = Object;

  onValueChange(newValue: string): void {
    this.value = newValue;
    this.valueChange.emit(newValue);
    if (this.input) {
      this.input.emit();
    }
  }

  constructor() {}

  onChange!: (value: any) => void;
  onTouched!: () => void;

  onEnter(): void {
    this.enterEvent.emit();
  }

  onInput(e: any) {
    if (this.onlyNumber) {
      let value = e.target.value;

      // Loại bỏ tất cả các ký tự không phải là số, dấu phẩy hoặc dấu chấm
      value = value.replace(/[^0-9.,]/g, '');

      // Kiểm tra nếu có nhiều hơn một dấu chấm
      const parts = value.split('.');
      if (parts.length > 2) {
        // Giữ lại phần trước dấu chấm thứ hai và phần sau dấu chấm đầu tiên
        value = parts[0] + '.' + parts.slice(1).join('');
      }

      // Đảm bảo dấu phẩy có thể xuất hiện sau dấu chấm và giới hạn hai chữ số sau dấu chấm
      const dotIndex = value.indexOf('.');
      if (dotIndex !== -1) {
        // Phân tách phần trước và sau dấu chấm
        const beforeDot = value.substring(0, dotIndex);
        let afterDot = value.substring(dotIndex + 1).replace(/,/g, '');

        // Giới hạn phần sau dấu chấm chỉ có tối đa hai chữ số
        if (afterDot.length > 2) {
          afterDot = afterDot.substring(0, 2);
        }

        // Ghép lại phần trước và sau dấu chấm
        value = beforeDot + '.' + afterDot;
      }

      // Cập nhật giá trị sau khi xử lý
      e.target.value = value;
      this.value = value;
    }
    if (this.input) {
      this.input.emit(e);
    }
  }

  checkError(): boolean {
    if (this.control.errors) {
      const {required, email, pattern, ...errorOther} = this.control.errors;
      if (!required && !email && !pattern && errorOther && Object.keys(errorOther).length !== 0) {
        return true;
      }
    }
    return false;
  }

  onClick(e: any) {
    if (this.click) {
      this.click.emit();
    }
  }

  onBlur() {
    if (this.blur) {
      this.blur.emit();
    }
  }

  ngOnChanges(changes: any): void {
    if (this.control && changes.disabled && changes.disabled.currentValue) {
      this.control.disable();
    } else if (this.control) {
      this.control.enable();
    }
  }

  writeValue(): void {}

  ClearAll(value: string): void {
    this.control.setValue(value);
    if (this.input) {
      this.input.emit();
    }
  }

  ngOnInit() {
    if (this.control) {
      this.value = this.control.value;
      this.control.valueChanges.subscribe((value: any) => {
        this.value = value;
      });
    }
  }
  ngAfterViewInit() {
    if (this.initFocus && this.control) this.inputControl.nativeElement.focus();
    if (this.initFocus && !this.control) this.inputNoControl.nativeElement.focus();
    if (this.control && this.disabled) {
      this.control.disable();
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
}
