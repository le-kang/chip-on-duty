(function() {
  'use strict';

  angular
    .module('chipOnDuty', ['ngMaterial', 'ngResource', 'ngSanitize'])
    .constant('ROSLIB', ROSLIB)
    .controller('AppController', AppController);

  function AppController($interval, $timeout) {
    var vm = this;
    vm.activationCode = '';
    vm.activity = null;
    vm.state = null;
    vm.activating = false;
    vm.currentImageIndex = 0;
    vm.cureentSurveyQuestionIndex = 0;
    vm.mobileNumber = '';
    vm.answer = '';
    vm.enterCode = enterCode;
    vm.deleteCode = deleteCode;
    vm.activate = activate;
    vm.setState = setState;
    vm.conductSurvey = conductSurvey;
    vm.answerSurveyQuestion = answerSurveyQuestion;
    vm.isValidMobileNumber = isValidMobileNumber;
    vm.enterNumber = enterNumber;
    vm.deleteNumber = deleteNumber;
    vm.sendOffer = sendOffer;

    function enterCode(char) {
      if (vm.activationCode.length < 6) {
        vm.activationCode += char;
      }
    }

    function deleteCode() {
      if (vm.activationCode.length > 0) {
        vm.activationCode = vm.activationCode.slice(0, -1);
      }
    }

    function activate() {
      vm.activating = true;
      // TODO: use real API
      $timeout(function() {
        vm.activity = {
          shopkeeper: {
            name: 'King\'s Cafe'
          },
          product: {
            name: 'Food'
          },
          survey: {
            surveyItems: [
              {
                question: 'How do you like our food?',
                options: ['I like it', 'Neutral', 'Not very much']
              },
              {
                question: 'Have you used our products/service before?',
                options: ['Yes', 'No']
              },
              {
                question: 'How likely is it that you would recommend us to a friend?',
                options: ['Very likely', 'Somewhat likely', 'Neutral', 'Somewhat unlikely', 'Very unlikely']
              }
            ]
          }
        };
        vm.state = 'demo';
        displayImage();
      }, 3000);
    }

    function setState(state) {
      vm.state = state;
    }

    function conductSurvey() {
      vm.state = 'conduct survey';
      vm.cureentSurveyQuestionIndex = 0;
      vm.surveyResults = [];
    }

    function answerSurveyQuestion(question) {
      $timeout(function() {
        vm.surveyResults.push({
          question: question,
          answer: vm.answer
        });
        vm.cureentSurveyQuestionIndex++;
        vm.answer = '';
        if (vm.cureentSurveyQuestionIndex == vm.activity.survey.surveyItems.length) {
          vm.state = 'offer reward';
        }
      }, 200);
    }

    function isValidMobileNumber() {
      var pattern = new RegExp(/^04[0-9]{8}$/);
      return pattern.test(vm.mobileNumber);
    }

    function enterNumber(number) {
      if (vm.mobileNumber.length < 10) {
        vm.mobileNumber += number;
      }
    }

    function deleteNumber() {
      if (vm.mobileNumber.length > 0) {
        vm.mobileNumber = vm.mobileNumber.slice(0, -1);
      }
    }

    function sendOffer() {
      vm.mobileNumber = '';
      vm.state = 'say goodbye';
    }

    function displayImage() {
      vm.currentImageIndex = 0;
      vm.imageTimer = $interval(function() {
        vm.currentImageIndex++;
        if (vm.currentImageIndex > 3) {
          vm.currentImageIndex = 0;
        }
      }, 3000)
    }
  }

})();