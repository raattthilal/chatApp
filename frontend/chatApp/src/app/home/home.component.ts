import { Component, OnInit } from '@angular/core';
import { LoginservService } from '../loginserv.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  name;
  text;
  data=[
    {name:"hilal"},
    {name:"akash"},
    {name:"theppan"},
    {name:"vaishnv"},
    {name:"koya"},
  ]
  constructor(private loginService : LoginservService) { }
logout(){
  this.loginService.logout()
}
chat(x){
  console.log("Start chat with : "+ x);
  
}
  ngOnInit(){
    this.loginService.checktoken()
    this.name=localStorage.getItem('name');
  }

}
