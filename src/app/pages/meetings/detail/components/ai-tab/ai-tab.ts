import { Component } from '@angular/core';
import { NzEmptyModule } from 'ng-zorro-antd/empty';

// =====================================================
// AiTab — tóm tắt + transcript AI.
// BE chưa có endpoint transcript/summary nên tab chỉ hiển
// thị trạng thái trung thực, KHÔNG bịa nội dung/spinner.
// Cần BE: GET transcript, GET/POST summary (+ trạng thái).
// =====================================================
@Component({
    selector: 'app-ai-tab',
    templateUrl: './ai-tab.html',
    imports: [NzEmptyModule],
})
export class AiTab {}
