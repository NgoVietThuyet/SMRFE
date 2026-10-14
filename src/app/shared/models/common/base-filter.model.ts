export class BaseFilter {
    currentPage: number = 1;
    pageSize: number = 20;
    keyWord: string = '';
    isActive: boolean = true;
    isPaging: boolean = true;
    dataFilter : any;
}
