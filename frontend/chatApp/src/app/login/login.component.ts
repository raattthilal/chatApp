import { Component, OnInit } from '@angular/core';
import { LoginservService } from '../loginserv.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  constructor(private loginService : LoginservService ,private router : Router) { }
data={
  username:'',
  password:''
}
failed;
login(){
  if(this.data.username==''||this.data.password==''){
    if(this.data.username==''&&this.data.password==''){
      alert("Please Enter User Credentials")
    }else{
    if(this.data.username==''){
      alert("Please Enter User name")
    } 
    if(this.data.password==''){
      alert("Please Enter password")
    }
   }
  }else{
 this.loginService.loginauth(this.data).subscribe((res)=>{
   console.log(res);
   if(res.success==0){
    alert(res.message)
   }
   if(res.success==1)
   {
     localStorage.setItem('token',res.token)
     localStorage.setItem('name',res.userDetails.name)
     this.router.navigate(['/home']);
   }
 })}
}
new(){
  
}

  ngOnInit(){
    this.loginService.checktoken()
  }

}
