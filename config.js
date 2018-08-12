const Config = {
    pageStart: 1,
    pageEnd: 157,
    pages: getPages.call(this),
    fileName: 'ccc.html',
    linksUri: 'http://w3.afulyu.pw/pw/thread.php?fid=3',
    detailUri: 'http://w3.afulyu.pw/pw'
};

function getPages() {
    return function () {
        let pages = [];
        for (let i = this.pageStart; i <= this.pageEnd; i++) {
            pages.push(i);
        }

        return pages;
    }
}

export default Config;