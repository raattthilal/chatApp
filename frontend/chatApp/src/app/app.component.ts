import { Component, OnInit } from '@angular/core';
import { LoginservService } from './loginserv.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'chatApp';
  constructor(private loginService : LoginservService){}
  ngOnInit() {
  this.loginService.checktoken()
  }
}


  