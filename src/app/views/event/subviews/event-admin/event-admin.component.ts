import { Component, OnInit, AfterViewInit, Input, ViewChild } from '@angular/core';
import { CloudFunctions } from '../../../../providers/cloud-functions';
import { UploadService } from '../../../../providers/imgur';
import { AngularFireDatabase } from '@angular/fire/database';
import { MdcSnackbar, MdcTextField } from '@angular-mdc/web';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { User } from 'firebase';
import Event from '../../../../models/Event';

@Component({
  providers: [CloudFunctions, UploadService],
  selector: 'toa-event-admin',
  templateUrl: './event-admin.component.html',
  styleUrls: ['./event-admin.component.scss']
})
export class EventAdminComponent implements OnInit, AfterViewInit {

  @Input() user: User;
  @Input() uid: string;
  @Input() eventKey: string;
  @Input() eventData: Event;

  generatingEventApiKey: boolean;
  eventApiKey: string;

  playlistURL: string;
  videos: any[];
  loadingVideos: boolean;
  showGetObjects: boolean;
  showConfirm: boolean;
  uploadingVideos: boolean;

  private images: any = {};
  private pitsMap: string = 'pits_map';
  private schedule: string = 'schedule';

  // These are for updating the Event Info
  @ViewChild('event_name') eventName: MdcTextField;
  @ViewChild('start_date') startDate: MdcTextField;
  @ViewChild('end_date') endDate: MdcTextField;
  @ViewChild('website') website: MdcTextField;
  @ViewChild('venue') venue: MdcTextField;
  @ViewChild('city') city: MdcTextField;
  @ViewChild('state') state: MdcTextField;
  @ViewChild('country') country: MdcTextField;

  constructor(private cloud: CloudFunctions, private db: AngularFireDatabase, private snackbar: MdcSnackbar,
              private translate: TranslateService, private router: Router, public imgur: UploadService) {

  }

  ngOnInit() {
    this.db.object(`eventAPIs/${ this.eventKey }`).snapshotChanges().subscribe(item => {
      this.eventApiKey = item && item.payload.val() ? item.payload.val() + '' : null;
    });
    this.showGetObjects = true;
  }

  ngAfterViewInit() {
    // Setup the edit event
    this.setFieldText(this.eventName, this.eventData.eventName);
    this.setFieldText(this.startDate, this.eventData.startDate.substr(0, 10));
    this.setFieldText(this.endDate, this.eventData.endDate.substr(0, 10));
    this.setFieldText(this.website, this.eventData.website);

    this.setFieldText(this.website, this.eventData.website);
    this.setFieldText(this.venue, this.eventData.venue);
    this.setFieldText(this.city, this.eventData.city);
    this.setFieldText(this.state, this.eventData.stateProv);
    this.setFieldText(this.country, this.eventData.country);
  }

  generateEventApiKey(): void {
    this.generatingEventApiKey = true;
    this.cloud.generateEventApiKey(this.uid, this.eventKey).then(() => {
      this.generatingEventApiKey = false;
    }, (err) => {
      this.showSnackbar('general.error_occurred', `HTTP-${err.status}`);
    }).catch(console.log);
  }

  playlistMatchify() {
    const playlistId = /[&|\?]list=([a-zA-Z0-9_-]+)/gi.exec(this.playlistURL || '');

    if (playlistId && playlistId.length > 0) {
      this.playlistURL = '';
      this.videos = [];
      this.loadingVideos = true;
      this.cloud.playlistMatchify(this.uid, this.eventKey, playlistId[1]).then((data: {}) => {
        this.loadingVideos = false;
        if (data && data['matches'].length > 0) {
          this.videos = data['matches'];
          this.showGetObjects = false;
          this.showConfirm = true;
        } else {
          this.showSnackbar('pages.event.subpages.admin.playlist_card.error');
        }
      }, (err) => {
        this.loadingVideos = false;
        this.showSnackbar('general.error_occurred', `HTTP-${err.status}`);
      });
    } else {
      this.showSnackbar('pages.event.subpages.admin.playlist_card.invalid_url');
    }
  }

  setVideos() {
    if (this.videos && this.videos.length > 0) {
      this.uploadingVideos = true;
      const toUpload = [];
      this.videos.forEach(function (video) {
        toUpload.push({
          'match_key': video['match_key'],
          'video_url': video['video_url']
        })
      });
      this.cloud.setVideos(this.uid, this.eventKey, toUpload).then((data: {}) => {
        this.uploadingVideos = false;
        this.showGetObjects = true;
        this.showConfirm = false;

        this.showSnackbar('pages.event.subpages.admin.playlist_card.successfully', null, this.videos.length);

        this.videos = [];
      }, (err) => {
        this.uploadingVideos = false;
        this.showSnackbar('general.error_occurred', `HTTP-${err.status}`);
      });
    } else {
      this.showSnackbar('pages.event.subpages.admin.playlist_card.error');
    }
  }

  updateEvent() {
    const json = [
      {
       'event_key':  this.eventKey,
       'event_name':  this.getFieldText(this.eventName),
       'start_date':  new Date(this.getFieldText(this.startDate)).toISOString(),
       'end_date':  new Date(this.getFieldText(this.endDate)).toISOString(),
       'venue':  this.getFieldText(this.venue),
       'city':  this.getFieldText(this.city),
       'state':  this.getFieldText(this.state),
       'country':  this.getFieldText(this.country),
       'website':  this.getFieldText(this.website)
      }
    ];

    this.cloud.updateEvent(this.uid, this.eventKey, json).then((data: {}) => {
      this.showSnackbar('pages.event.subpages.admin.update_info_card.successfully');
    }, (err) => {
      this.showSnackbar('general.error_occurred', `HTTP-${err.status}`);
    });
  }

  setFieldText(elm: MdcTextField, text: string) {
    elm.setValue(text);
  }

  getFieldText(elm: MdcTextField) {
    return elm.value;
  }

  showSnackbar(translateKey: string, errorKey?: string, value?: number) {
    const isEmail = (errorKey) ? errorKey.indexOf('428') > -1 : undefined;
    const msg = (isEmail) ? 'pages.event.subpages.admin.verify_email' : translateKey;

    this.translate.get(msg, {value: value}).subscribe((res: string) => {

      const message = (errorKey && !isEmail) ? `${res} (${errorKey})` : res;

      const snackBarRef = this.snackbar.open(message, (isEmail) ? 'Verify' : null);

      snackBarRef.afterDismiss().subscribe(reason => {
        if (reason === 'action') {
          this.user.sendEmailVerification().then(() => {
            this.showSnackbar(`pages.event.subpages.admin.success_sent_verify_email`);
          }).catch((err) => {
            this.showSnackbar(`general.error_occurred`, `HTTP-${err.status}`);
          })
        }
      });
    });
  }

  handleImage(e, type: string){
    const image = e.target.files[0];
    if (image) {
      const reader = new FileReader();
      reader.onload = () => {
        this.images[type] = {
          'filename': image.name,
          'base64': btoa(reader.result.toString())
        };
      };
      reader.readAsBinaryString(image);
    }
  }

  uploadImage(type){
    if (this.images[type]) {
      this.imgur.uploadImage(this.images[type]['base64'])
        .then((data: any) => {
          let image = data.data;
          let mediaData = {
            "event_key": this.eventKey,
            "primary": false,
            "media_link": image.link,
            "media_type": -1,
          };

          if (type === this.pitsMap) {
            mediaData.media_type = 0;
          } else if (type === this.schedule) {
            mediaData.media_type = 1;
          }

          if (mediaData.media_type > -1) {
            this.cloud.addEventMedia(this.uid, mediaData).then(() => {
              this.showSnackbar('pages.event.subpages.admin.update_info_card.successfully');
              this.images[type] = null;
            }).catch((err) => {
              this.showSnackbar(`general.error_occurred`, `HTTP-${err.status}`);
            });
          } else {
            this.showSnackbar(`general.error_occurred`);
          }
        }, (err) => {
          this.showSnackbar('general.error_occurred', `HTTP-${err.status}`);
        });
    } else {
      this.showSnackbar(`general.error_occurred`);
    }
  }

  getFileName(type: string) {
    if (this.images[type]) {
      return this.images[type]['filename'];
    }
    return null
  }

  sendAnalytic(category, action): void {
    (<any>window).ga('send', 'event', {
      eventCategory: category,
      eventLabel: this.router.url,
      eventAction: action,
      eventValue: 10
    });
  }
}
