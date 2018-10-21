import Crawler from 'crawler';
import _ from 'lodash';
import fs from 'fs';
import {
    promisify
} from 'util';
import Config from './config';

class CrawlerApplication {

    constructor() {
        this.config = Config;
        this.pages = this.config.pages();
        this.uri = this.config.uris.list;
        this.sleepMultiple = Config.sleepMultiple;
        this.crawlerFactory = CrawlerFactory;
        this.crawlerLinks = new CrawlerLinks();
        this.crawlerDetail = new CrawlerDetail();
        this.htmlBuilder = new CrawlerHtmlBuilder();
    }

    init(config) {
        this.config = Object.assign(this.config, config);
    }

    async start() {
        let startTime = new Date();

        fs.createWriteStream(this.config.fileName).write('');

        console.log(`${this.getCurrentTime()} - Start Crawling Pages...`);

        let pageUrls = this.pages.map(page => `${this.uri}&page=${page}`);

        let shortlistOptions = await this.crawlerFactory.queues({
            uris: pageUrls,
            linkGroupStage: [],
            handler: this.crawlerLinks.handler.bind(this.crawlerLinks)
        });

        let linkGroupStage = this.shuffle(shortlistOptions.linkGroupStage);

        let sleepSeconds = 0;

        let linkGroupFinal = await Promise.all(
            _.map(linkGroupStage, async (uris, yearMonth) => {
                let groupStartTime = new Date();

                await this.sleep(sleepSeconds++);

                console.log(`${this.getCurrentTime()} - Start Crawling Links, YearMonth: ${yearMonth}, Length: ${uris.length} ...`);

                let options = await this.crawlerFactory.queues({
                    uris,
                    linkGroupSemiFinal: [],
                    handler: this.crawlerDetail.handler.bind(this.crawlerDetail)
                });

                let groupTimeSpan = this.getTimeSpan(groupStartTime, new Date());

                console.log(`${this.getCurrentTime()} - Finished Crawling Links, YearMonth: ${yearMonth}, Length: ${options.linkGroupSemiFinal.length}, Time Span: ${groupTimeSpan} Seconds ...`);

                return options.linkGroupSemiFinal;
            })
        );

        let linkFinalist = this.reduce(linkGroupFinal);

        console.log(`${this.getCurrentTime()} - Start Print, Length: ${linkFinalist.length} ...`);

        this.print(linkFinalist);

        let timeSpan = this.getTimeSpan(startTime, new Date());

        console.log(`Finished. Time Span: ${timeSpan} Seconds`);
    }

    async print(linkFinalist) {
        if (linkFinalist.length === 0) {
            return;
        }

        let html = '';

        _.each(linkFinalist, (link) => {
            html += this.htmlBuilder.buildLink(link);
        });

        const appendFileSync = await promisify(fs.appendFileSync);
        appendFileSync(Config.fileName, html);
    }

    shuffle(links) {
        return _.groupBy(links, link => link.yearMonth);
    }

    reduce(linkGroup) {
        let concatList = [];

        _.each(linkGroup, (links) => {
            concatList.push(...links);
        });

        let sortedList = _.orderBy(concatList, ['publishedTime'], ['desc']);

        return sortedList;
    }

    getCurrentTime() {
        return new Date().toLocaleString();
    }

    getTimeSpan(start, end) {
        let diff = end.getTime() - start.getTime();
        return _.toInteger(diff / 1000);
    }

    sleep(seconds) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, seconds * this.sleepMultiple * 1000);
        });
    }
}

class CrawlerLinks {

    constructor() {
        // this.constants = Constants;
        this.uri = Config.uris.detail;
        this.keyWords = Config.keyWords.list;
    }

    async handler(res) {
        let $ = res.$;

        if (_.isUndefined($)) {
            console.log(res.body + ' href: ' + res.options.uri);
            return;
        }

        let links = $('h3 a');

        let filterLinks = _.filter(links, link => this.hasKeyWordInLink($(link).text()));

        let uris = filterLinks.map(link => {
            return {
                yearMonth: this.getYearMonth($, link),
                uri: `${this.uri}/${link.attribs.href}`
            }
        });

        res.options.linkGroupStage.push(...uris);
    }

    getYearMonth($, link) {
        let publishedTime = $($(link).parents('tr').find('a.f10')).text().trim();
        return publishedTime.substr(0, 4) + publishedTime.substr(5, 2);
    }

    hasKeyWordInLink(linkText) {
        for (let keyWord of this.keyWords) {
            if (linkText.indexOf(keyWord) > 0) {
                return true;
            }
        }

        return false;
    }
}

class CrawlerDetail {

    constructor() {
        // this.constants = Constants;
        this.keyWords = Config.keyWords.detail;
    }

    handler(res) {
        this.res = res;
        let $ = res.$;
        this.lpNums = [];

        if (_.isUndefined($)) {
            console.log(res.body + ' href: ' + res.options.uri);
            return;
        }

        var keyWordsInDetail = _.filter(this.keyWords, (keyWord) => {
            let hasNum = res.body.indexOf(keyWord) > 0;

            if (hasNum) {
                this.getlpNums(keyWord);
            }

            return this.lpNums.length > 0;
        });

        if (keyWordsInDetail.length > 0) {
            let link = {
                url: res.options.uri,
                text: $('#subject_tpc').text(),
                publishedTime: $(_.first($('.fl.gray'))).text().slice(4),
                keyWords: keyWordsInDetail,
                lpNums: this.lpNums
            };

            res.options.linkGroupSemiFinal.push(link);
        }
    }

    getlpNums(keyWord, preIndex) {
        let index = this.getKeyWordIndex(keyWord, preIndex);
        if (index < 0) {
            return;
        }

        let numLength = this.getNumLength(keyWord, index);
        if (numLength < 0) {
            this.getlpNums(keyWord, index + 1);
            return;
        }

        let lpNum = this.res.body.substring(index, index + keyWord.length + numLength);

        if (!this.validatelpNum(lpNum)) {
            this.getlpNums(keyWord, index + 1);
            return;
        }

        lpNum = keyWord + '-' + lpNum.slice(-3);

        let hasNum = _.findIndex(this.lpNums, num => lpNum === num);
        if (hasNum < 0) {
            this.lpNums.push(lpNum);
        }

        this.getlpNums(keyWord, index + 1);
    }

    getNumLength(keyWord, index) {
        let numLength = 3;

        let body = this.res.body;

        let nextLetter = body.substring(index + keyWord.length, index + keyWord.length + 1);

        if (nextLetter !== '-' && Number.isNaN(parseInt(nextLetter))) {
            return -1;
        }

        if (body.substring(index + keyWord.length, index + keyWord.length + 1) === '-') {
            numLength = 4;
        }

        return numLength;
    }

    validatelpNum(lpNum) {
        const num = lpNum.slice(-3);
        return !(Number.isNaN(parseInt(num[0])) || Number.isNaN(parseInt(num[1])) || Number.isNaN(parseInt(num[2])));
    }

    getKeyWordIndex(keyWord, preIndex) {
        let body = this.res.body;

        let index = body.indexOf(keyWord, preIndex);

        if (index < 0) {
            index = body.indexOf(keyWord.toLowerCase(), preIndex)
        }

        return index;
    }
}

class CrawlerHtmlBuilder {

    constructor() {

    }

    buildLink(link) {
        let html = '';

        html = `
                <p>
                    <span>${link.publishedTime}</span>
                    <a style='margin-left:10px;width:600px;display: inline-block;' 
                        target="_blank" href='${link.url}'>${link.text}
                    </a>
                    <span>${link.lpNums.join(",")}</span>
                </p>
                `;

        return html;
    }
}

class CrawlerFactory {

    static create(handler) {
        return new Crawler({
            maxConnections: 10000,
            // rateLimit: 1,
            proxy: 'http://127.0.0.1:1080',
            callback: this.callback.call(null).bind(handler)
        });
    }

    static queues(opts) {
        return new Promise((resolve) => {
            let crawler = this.create(opts.handler);
            Object.assign(crawler.options, opts);

            crawler.queue(opts.uris);

            crawler.on('drain', () => {
                resolve(crawler.options);
            });
        });
    }

    static queue(opts) {
        return new Promise((resolve) => {
            let crawler = this.create(resolve);
            Object.assign(crawler.options, opts);

            crawler.queue({
                uri: opts.uri
            });
        });
    }

    static callback() {
        return function (error, res, done) {
            if (error) {
                console.log(error);
            } else {
                this.call(null, res);
            }
            done();
        };
    }
}

let app = new CrawlerApplication();
app.start();