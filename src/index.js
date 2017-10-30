import { render } from 'melody-component';
import main from './main';

render(document.getElementById('root'), main, {
    message: 'Welcome to Melody!'
});