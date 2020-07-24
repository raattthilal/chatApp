module.exports = function facilitySurveyQuestionOption(sequelize) {
    var Sequelize = sequelize.constructor;

    var ret =
      sequelize.define('facilitySurveyQuestionOption', {

        option_name_en: {
          type: Sequelize.STRING
        },
        option_name_ml: {
          type: Sequelize.STRING
        },
        question_group_id: {
          type: Sequelize.INTEGER
        },
        facility_survey_question_id: {
          type: Sequelize.INTEGER
        },
        facility_type_id: {
          type: Sequelize.INTEGER
        },
        sort_order: {
          type: Sequelize.INTEGER
        },
        status: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        },
        modified_at: {
          type: 'TIMESTAMP',
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          allowNull: false
        }
  
      }, {
        tableName: 'facility_survey_question_option',
        timestamps: false
  
      });
  
    return ret;
  }
  