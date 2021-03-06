import React from 'react'
import firebase from './firebase';

class TextAnalysis extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        error: null,
        isLoaded: false,
        categories: [],
        entities: [],
        sentiment: {},
        numToDo: 0,
        users:[]
      };
    }
  
    componentDidMount() {
        this.newMessage("This weekend, you have access to Marquee by Goldman Sachs, where you can learn about and access our Global Investment Research (GIR) Factor Profile Percentiles dataset. ", "123");
    }


    newMessage(text, name) {
        // console.log(text);
        const postParameters = {
       "document": {
        "content": text,
        "type": "PLAIN_TEXT"
       },
       "features": {
        "classifyText": true,
        "extractDocumentSentiment": true,
        "extractEntities": true,
        "extractEntitySentiment": true,
        "extractSyntax": false
       }
      }
  
      fetch('https://language.googleapis.com/v1/documents:annotateText?key=AIzaSyBnfMYcFxnIFu_X33YEPkbY95yP0IUwdbc', {    
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(postParameters),
          })
        .then(res => res.json())
        .then(
          (result) => {
            this.setState({
              isLoaded: true,
              categories: result.categories,
              entities: result.entities,
              sentiment: result.documentSentiment,
            });
            console.log(result);
            let categoryMatches = this.categorySimilarity();
            console.log(this.entitySimilarity(categoryMatches));

            //TODO:save categories and entities in db
            
          },
          (error) => {
            this.setState({
              isLoaded: true,
              error
            });
          }
        )
    
    }
  
    render() {
      const { error, isLoaded, categories, entities } = this.state;
      if (error) {
        return <div>Error: {error.message}</div>;
      } else if (!isLoaded) {
        return <div>Loading...</div>;
      } else if (categories != null && categories.length != 0){
        return <div>Res: {categories[0].name}</div>;
      } else{
        return <div>nothing here</div>;
      }
    }

    

    categorySimilarity(){
        var ref = firebase.database().ref("users"); // query to get all user data

        let allUsers = [];
        ref.on('value', snapshot => {
            snapshot.forEach((childSnapshot) => {
                var key = childSnapshot.key; // you will get your key here
                let user = snapshot.val()[key];
                allUsers.push(user);
            })
        });
        this.setState({users: allUsers});


        let categories = this.state.categories;
        //if no category, can't narrow it down, so search other things on all users
        if(categories == null || categories.length == 0) return this.state.users;
        //for now, I am just matching the top category, adding more may help
        let category = categories[0];
        //if no results, contrinue to go levels higher according to /
        let categoryPath = category.name.split('/');
        for(let i = categoryPath.length; i > 0; i--){
            let currCategory = categoryPath.slice(0, i);
            let commonUsers = [];
            this.state.users.forEach(user => {
                if(user.messages != null){
                    user.messages.forEach(message => {
                        if(message.categories != null && message.categories.length != 0){
                            let userPath = message.categories[0].name.split('/');
                            if(userPath.length >= i){
                                let userCategory = userPath.slice(0, i);
                                if(userCategory == currCategory){
                                    commonUsers.add(user);
                                }
                            }
                        }
                    });
                }
            });
            //we got results
            if(commonUsers.length != 0) return commonUsers;
        }
        //no matches
        return this.state.users;
    }

    entitySimilarity(possibleUsers){
        // let users = firebase.database().ref('users');
         let this2 = this;
         this.entitySimilarPromise().then(function(response) {
             this2.entityCommon(possibleUsers);
         })
     }

     entitySimilarPromise() {
        let entities = this.state.entities;
        let this2 = this;
        return new Promise(function(resolve, reject) {
            if(entities != null){
                    this2.state.numToDo = entities.length;
                    entities.forEach(entity => {
                        this2.entityThesourous(entity, resolve);
                    }); 
               }
        });
    }

    entityThesourous(entity, resolve){
         let text = entity.name;
             //fetch('http://words.bighugelabs.com/api/2/eb3bde23bd68b58eca5cea41783ea35e/' + text + '/json')
        fetch('https://www.dictionaryapi.com/api/v3/references/thesaurus/json/' + text + '?key=e2232eec-db13-48e0-bedd-c4afde262ab3')
        .then(res => res.json())
        .then(
        (result) => {
            if(result != null){
                result.forEach(res => {
                    if(typeof res === 'string' || res instanceof String){     
                        let newEntity=    {
                            name: res,
                            salience: entity.salience / 3,
                        };
                        //TODO: add to db
                    } else{
                        if(res.meta.syns != null){
                            res.meta.syns[0].forEach(syn => {
                                let newEntity=    {
                                    name: syn,
                                    salience: entity.salience / 3,
                                };
                                //TODO: add to db
                            });
                        }
                        
                    }       
                });
                this.setState({numToDo: this.state.numToDo - 1});
                if (this.state.numToDo == 0) {
                    resolve("it worked");
                }         
            }
        
        },
        (error) => {}
        );
    }

    entityCommon(possibleUsers){
        let userSimilarities = [];
        possibleUsers.forEach(user => {
            let maxSimilarity = 0;
            if(user.messages != null){
            user.messages.forEach(message=> {
                let otherEntitites = message.entities;
                if(otherEntitites != null && this.state.entities != null){
                    let a = [], b = [];
                    if (otherEntitites.length > this.state.entities.length){
                        a= otherEntitites; b=this.state.entities;
                    } 
                    else{
                        a = this.state.entities; b = otherEntitites;
                    }
                    let msgSimilarity = 0;
                    a.forEach(entity => {
                        b.forEach(entity2 => {

                            if(entity.name == entity2.name){
                                msgSimilarity += entity.salience + entity2.salience
                            }
                        })
                    });
                    maxSimilarity = Math.max(maxSimilarity, msgSimilarity);
                }
            })
            }
            user["score"] = maxSimilarity;
            userSimilarities.push(user);
            
        });
        console.log(userSimilarities);
        return this.sentimentSimilarity(userSimilarities);
    }

    sentimentSimilarity(currentRankings){
        let newRankings = {};
        currentRankings.forEach(user=> {
            if(user.messages != null){
            user.messages.forEach(message=> {
                let sentiment = message.documentSentiment;
                let newSentiment = this.state.sentiment;
                //TODO: comment below line out
                sentiment = newSentiment;
                console.log(newSentiment);
                //find 'dist' bt two sentiment scores
                let sentDist = (sentiment.magnitude - newSentiment.magnitude)^2 + 
                    (sentiment.score - newSentiment.score)^2;
                let normDist = 2 / Math.abs(sentDist + 1);
                console.log(normDist);
                user.score = user.score + normDist;

            });
            newRankings[user.uid] = user.score;
            }
        })
        console.log(newRankings);
        return newRankings;

    }

  }

  export default TextAnalysis