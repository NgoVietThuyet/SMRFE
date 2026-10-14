import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })

export class JsonUtils {

    constructor() { }

    static formatPrettyJSON(str: string): string {
        try {
            const obj = JSON.parse(str);
            const json = JSON.stringify(obj, null, 2);
            
            return json
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|\b\d+\.?\d*\b)/g, match => {
                    let cls = 'number';
                    if (/^"/.test(match)) {
                        if (/:$/.test(match)) {
                            cls = 'key';
                        } else {
                            cls = 'string';
                        }
                    } else if (/true|false/.test(match)) {
                        cls = 'boolean';
                    } else if (/null/.test(match)) {
                        cls = 'null';
                    }
                    return `<span class="${cls}">${match}</span>`;
                });
        } catch (e) {
            return str;
        }
    }

}
