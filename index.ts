import express, {type Request, type Response, type Express} from 'express';

const app:Express = express();
const port:number = 3000;


app.get('/', (req:Request, res:Response) => {
    res.send("Hello World");
});


app.listen(port, () => {
    console.log(`App listening to port ${port}`);
})
