import firebase, { auth, provider } from 'firebase';

var config = {
    apiKey: "AIzaSyDMEEQmuk_PLcp7qUZL0hlMokQpTDOJ9z4",
    authDomain: "yhack-2018.firebaseapp.com",
    databaseURL: "https://yhack-2018.firebaseio.com",
    projectId: "yhack-2018",
    storageBucket: "yhack-2018.appspot.com",
    messagingSenderId: "165042125477"
  };
  firebase.initializeApp(config);

  // export const auth = firebase.auth();

  export default firebase;
