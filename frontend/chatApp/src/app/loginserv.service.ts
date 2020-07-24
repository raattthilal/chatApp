import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';

@Injectable({
  providedIn: 'root'
})
export class LoginservService {
  private authurl ="/admin/login";
  constructor(private http: HttpClient, private router: Router) { }
  loginauth(data) {
    return this.http.post<any>(this.authurl , data)
  }
  checktoken(){
    console.log("chktokn");
    
    const token = localStorage.getItem('token');
    

    if(token){
       const appRoutes: Routes = [
        {path:'home',component:HomeComponent}
      ]
    }
    else{
      console.log('redirecting to login page')
      this.router.navigate(['/login']);
    }
   }
  logout(){
    localStorage.removeItem('token');
    localStorage.removeItem('name');
    this.router.navigate(['/login']);
  }
}
